var assert = require('assert'),
    Promise = require('bluebird'),
    request = require('request'),
    helpers = require('./helpers'),
    StreamingAPIConnection = require('./streaming-api-connection'),
    util = require('util');


var STATUS_CODES_TO_ABORT_ON = [400, 401, 403, 404, 406, 410, 422];

var Dweetio = function() {
    if (!(this instanceof Dweetio)) {
        return new Dweetio();
    }
    this._dweet_time_minus_local_time_ms = 0;
};

Dweetio.prototype.get = function(path, params, callback) {
    return this.request('GET', path, params, callback);
};

Dweetio.prototype.post = function(path, params, callback) {
    return this.request('POST', path, params, callback);
};

Dweetio.prototype.request = function(method, path, params, callback) {
    var self = this;
    assert(method == 'GET' || method == 'POST');
    // if no `params` is specified but a callback is, use default params
    if (typeof params === 'function') {
        callback = params;
        params = {}
    }

    return new Promise(function(resolve, reject) {
        var _returnError = function(err) {
            if (callback && typeof callback === 'function') {
                callback(err);
            }
            reject(err);
        };

        self._buildReqOpts(method, path, params, function(err, reqOpts) {
            if (err) {
                _returnError(err);
                return;
            }

            var dweetOpts = (params && params.dweet_options) || {};

            process.nextTick(function() {
                // ensure all HTTP i/o occurs after the user has a chance to bind their event handlers
                self._doRestApiRequest(reqOpts, dweetOpts, method, function(err, parsedBody, resp) {
                    self._updateClockOffsetFromResponse(resp);

                    //TODO HTTPS CA check
                    // if (self.config.trusted_cert_fingerprints) {
                    //     if (!resp.socket.authorized) {
                    //         // The peer certificate was not signed by one of the authorized CA's.
                    //         var authErrMsg = resp.socket.authorizationError.toString();
                    //         var err = helpers.makeTwitError('The peer certificate was not signed; ' + authErrMsg);
                    //         _returnErrorToUser(err);
                    //         return;
                    //     }
                    //     var fingerprint = resp.socket.getPeerCertificate().fingerprint;
                    //     var trustedFingerprints = self.config.trusted_cert_fingerprints;
                    //     if (trustedFingerprints.indexOf(fingerprint) === -1) {
                    //         var errMsg = util.format('Certificate untrusted. Trusted fingerprints are: %s. Got fingerprint: %s.',
                    //             trustedFingerprints.join(','), fingerprint);
                    //         var err = new Error(errMsg);
                    //         _returnErrorToUser(err);
                    //         return;
                    //     }
                    // }

                    if (callback && typeof callback === 'function') {
                        callback(err, parsedBody, resp);
                    }

                    resolve({data: parsedBody, resp: resp});
                });
            });
        });
    });
};

Dweetio.prototype._updateClockOffsetFromResponse = function(resp) {
    var self = this;

    if (resp && resp.headers && resp.headers.date &&
        new Date(resp.headers.date).toString() !== 'Invalid Date') {
        var dweetTimeMs = new Date(resp.headers.date).getTime();
        self._dweet_time_minus_local_time_ms = dweetTimeMs - Date.now();
    }
};

Dweetio.prototype._buildReqOpts = function(method, path, params, callback) {
    var self = this;
    params = params || {};

    // clone `params` object so we can modify it without modifying the user's reference
    var paramsClone = JSON.parse(JSON.stringify(params));
    // convert any arrays in `paramsClone` to comma-seperated strings
    var finalParams = this.normalizeParams(paramsClone);
    delete finalParams.dweet_options;

    // the options object passed to `request` used to perform the HTTP request
    var reqOpts = {
        headers: {
            'Accept': '*/*',
            'User-Agent': 'dweetio-node'
        },
        gzip: false,
        encoding: null
    };

    try {
        // finalize the `path` value by building it using user-supplied params
        path = helpers.moveParamsIntoPath(finalParams, path)
    } catch (e) {
        callback(e, null, null);
        return;
    }

    reqOpts.url = 'https://dweet.io/' + path;
    reqOpts.headers['Content-type'] = 'application/json';

    if (Object.keys(finalParams).length) {
        // not all of the user's parameters were used to build the request path
        // add them as a query string
        var qs = helpers.makeQueryString(finalParams);
        reqOpts.url += '?' + qs;
    }

    callback(null, reqOpts);
};

Dweetio.prototype._doRestApiRequest = function(reqOpts, dweetOptions, method, callback) {
    var request_method = request[method.toLowerCase()];
    var req = request_method(reqOpts);

    var body = '';
    var response = null;

    var onRequestComplete = function() {
        if (body !== '') {
            try {
                body = JSON.parse(body);
            } catch (jsonDecodeError) {
                // there was no transport-level error, but a JSON object could not be decoded from the request body
                // surface this to the caller
                var err = helpers.makeDweetError('JSON decode error: Dweet HTTP response body was not valid JSON');
                err.statusCode = response ? response.statusCode : null;
                err.allErrors.concat({error: jsonDecodeError.toString()});
                callback(err, body, response);
                return;
            }
        }

        if (typeof body === 'object' && (body.error || body.errors)) {
            // we got a Twitter API-level error response
            // place the errors in the HTTP response body into the Error object and pass control to caller
            var err = helpers.makeDweetError('Twitter API Error');
            err.statusCode = response ? response.statusCode : null;
            helpers.attachBodyInfoToError(err, body);
            callback(err, body, response);
            return;
        }

        // success case - no errors in HTTP response body
        callback(err, body, response);
    };

    req.on('response', function(res) {
        response = res;
        // read data from `request` object which contains the decompressed HTTP response body,
        // `response` is the unmodified http.IncomingMessage object which may contain compressed data
        req.on('data', function(chunk) {
            body += chunk.toString('utf8')
        });
        // we're done reading the response
        req.on('end', function() {
            onRequestComplete()
        });
    });

    req.on('error', function(err) {
        // transport-level error occurred - likely a socket error
        if (dweetOptions.retry &&
            STATUS_CODES_TO_ABORT_ON.indexOf(err.statusCode) !== -1) {
            // retry the request since retries were specified and we got a status code we should retry on
            self.request(method, path, params, callback);
        } else {
            // pass the transport-level error to the caller
            err.statusCode = null;
            err.code = null;
            err.allErrors = [];
            helpers.attachBodyInfoToError(err, body);
            callback(err, body, response);
        }
    })
};

Dweetio.prototype.stream = function(path, params) {
    var self = this;
    var dweetOptions = (params && params.dweet_options) || {};

    var streamingConnection = new StreamingAPIConnection();
    self._buildReqOpts('GET', path, params, function(err, reqOpts) {
        if (err) {
            // surface this on the streamingConnection instance (where a user may register their error handler)
            streamingConnection.emit('error', err);
            return;
        }
        // set the properties required to start the connection
        streamingConnection.reqOpts = reqOpts;
        streamingConnection.dweetOpts = dweetOptions;

        process.nextTick(function() {
            streamingConnection.start()
        });
    });
    return streamingConnection;
};

Dweetio.prototype.normalizeParams = function(params) {
    var normalized = params;
    if (params && typeof params === 'object') {
        Object.keys(params).forEach(function(key) {
            var value = params[key];
            // replace any arrays in `params` with comma-separated string
            if (Array.isArray(value))
                normalized[key] = value.join(',')
        });
    } else if (!params) {
        normalized = {};
    }
    return normalized;
};

module.exports = Dweetio;
