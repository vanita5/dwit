var EventEmitter = require('events'),
    util = require('util'),
    helpers = require('./helpers'),
    Parser = require('./parser'),
    request = require('request');

var STATUS_CODES_TO_ABORT_ON = [400, 401, 403, 404, 406, 410, 422];

var StreamingAPIConnection = function(reqOpts, dweetOps) {
    this.reqOpts = reqOpts;
    this.dweetOpts = dweetOps;
    this._dweet_time_minus_local_time_ms = 0;
    EventEmitter.call(this);
};

util.inherits(StreamingAPIConnection, EventEmitter);

/**
 * Resets the connection.
 * - clears request, response, parser
 * - removes scheduled reconnect handle (if one was scheduled)
 * - stops the stall abort timeout handle (if one was scheduled)
 */
StreamingAPIConnection.prototype._resetConnection = function() {
    if (this.request) {
        // clear our reference to the `request` instance
        this.request.removeAllListeners();
        this.request.destroy();
    }

    if (this.response) {
        // clear our reference to the http.IncomingMessage instance
        this.response.removeAllListeners();
        this.response.destroy();
    }

    if (this.parser) {
        this.parser.removeAllListeners();
    }

    // ensure a scheduled reconnect does not occur (if one was scheduled)
    // this can happen if we get a close event before .stop() is called
    clearTimeout(this._scheduledReconnect);
    delete this._scheduledReconnect;

    // clear our stall abort timeout
    this._stopStallAbortTimeout();
};

/**
 * Resets the parameters used in determining the next reconnect time
 */
StreamingAPIConnection.prototype._resetRetryParams = function() {
    // delay for next reconnection attempt
    this._connectInterval = 0;
    // flag indicating whether we used a 0-delay reconnect
    this._usedFirstReconnect = false
};

StreamingAPIConnection.prototype._startPersistentConnection = function() {
    var self = this;
    self._resetConnection();
    self._setupParser();
    self._resetStallAbortTimeout();
    self.request = request.get(this.reqOpts);
    self.emit('connect', self.request);
    self.request.on('response', function(response) {
        // reset our reconnection attempt flag so next attempt goes through with 0 delay
        // if we get a transport-level error
        self._usedFirstReconnect = false;
        // start a stall abort timeout handle
        self._resetStallAbortTimeout();
        self.response = response;
        if (STATUS_CODES_TO_ABORT_ON.indexOf(self.response.statusCode) !== -1) {
            var body = '';

            self.response.on('data', function(chunk) {
                body += chunk.toString('utf8');

                try {
                    body = JSON.parse(body);
                } catch (jsonDecodeError) {
                    // if non-JSON text was returned, we'll just attach it to the error as-is
                }

                var error = helpers.makeDweetError('Bad Dweet.io streaming request: ' + self.response.statusCode);
                error.statusCode = response ? response.statusCode : null;
                helpers.attachBodyInfoToError(error, body);
                self.emit('error', error);
                // stop the stream explicitly so we don't reconnect
                self.stop();
                body = null;
            });
        } else if (self.response.statusCode === 420) {
            // close the connection forcibly so a reconnect is scheduled by `self.onClose()`
            self._scheduleReconnect();
        } else {
            self.response.on('data', function(chunk) {
                self._connectInterval = 0;

                self._resetStallAbortTimeout();
                self.parser.parse(chunk.toString('utf8'));
            });

            self.response.on('error', function(err) {
                // expose response errors on twit instance
                self.emit('error', err);
            });

            // connected without an error response from Dweet.io, emit `connected` event
            // this must be emitted after all its event handlers are bound
            // so the reference to `self.response` is not interfered-with by the user until it is emitted
            self.emit('connected', self.response);
        }
    });
    self.request.on('close', self._onClose.bind(self));
    self.request.on('error', function(err) {
        self._scheduleReconnect.bind(self)
    });
    return self;
};


/**
 * Handle when the request or response closes.
 * Schedule a reconnect
 *
 */
StreamingAPIConnection.prototype._onClose = function() {
    var self = this;
    self._stopStallAbortTimeout();
    if (self._scheduledReconnect) {
        // if we already have a reconnect scheduled, don't schedule another one.
        // this race condition can happen if the http.ClientRequest and http.IncomingMessage both emit `close`
        return;
    }
    self._scheduleReconnect();
};

/**
 * Kick off the http request, and persist the connection
 *
 */
StreamingAPIConnection.prototype.start = function() {
    this._resetRetryParams();
    this._startPersistentConnection();
    return this;
};

/**
 * Abort the http request, stop scheduled reconnect (if one was scheduled) and clear state
 *
 */
StreamingAPIConnection.prototype.stop = function() {
    // clear connection variables and timeout handles
    this._resetConnection();
    this._resetRetryParams();
    return this;
};

/**
 * Stop and restart the stall abort timer (called when new data is received)
 *
 * If we go 90s without receiving data from dweet.io, we abort the request & reconnect.
 */
StreamingAPIConnection.prototype._resetStallAbortTimeout = function() {
    var self = this;
    // stop the previous stall abort timer
    self._stopStallAbortTimeout();
    //start a new 90s timeout to trigger a close & reconnect if no data received
    self._stallAbortTimeout = setTimeout(function() {
        self._scheduleReconnect()
    }, 90000);
    return this;
};

/**
 * Stop stall timeout
 *
 */
StreamingAPIConnection.prototype._stopStallAbortTimeout = function() {
    clearTimeout(this._stallAbortTimeout);
    // mark the timer as `null` so it is clear via introspection that the timeout is not scheduled
    delete this._stallAbortTimeout;
    return this;
};

/**
 * Computes the next time a reconnect should occur (based on the last HTTP response received)
 * and starts a timeout handle to begin reconnecting after `self._connectInterval` passes.
 *
 * @return {Undefined}
 */
StreamingAPIConnection.prototype._scheduleReconnect = function() {
    var self = this;
    if (self.response && self.response.statusCode === 420) {
        // start with a 1 minute wait and double each attempt
        if (!self._connectInterval) {
            self._connectInterval = 60000;
        } else {
            self._connectInterval *= 2;
        }
    } else if (self.response && String(self.response.statusCode).charAt(0) === '5') {
        // 5xx errors
        // start with a 5s wait, double each attempt up to 320s
        if (!self._connectInterval) {
            self._connectInterval = 5000;
        } else if (self._connectInterval < 320000) {
            self._connectInterval *= 2;
        } else {
            self._connectInterval = 320000;
        }
    } else {
        // we did not get an HTTP response from our last connection attempt.
        // DNS/TCP error, or a stall in the stream (and stall timer closed the connection)
        if (!self._usedFirstReconnect) {
            // first reconnection attempt on a valid connection should occur immediately
            self._connectInterval = 0;
            self._usedFirstReconnect = true;
        } else if (self._connectInterval < 16000) {
            // linearly increase delay by 250ms up to 16s
            self._connectInterval += 250;
        } else {
            // cap out reconnect interval at 16s
            self._connectInterval = 16000;
        }
    }

    // schedule the reconnect
    self._scheduledReconnect = setTimeout(function() {
        self._startPersistentConnection();
    }, self._connectInterval);
    self.emit('reconnect', self.request, self.response, self._connectInterval);
};

StreamingAPIConnection.prototype._setupParser = function() {
    var self = this;
    self.parser = new Parser();

    self.parser.on('element', function(msg) {
        self.emit('message', msg);
    });
    self.parser.on('error', function(err) {
        self.emit('parser-error', err)
    });
    self.parser.on('connection-limit-exceeded', function(err) {
        self.emit('error', err);
    });
};

StreamingAPIConnection.prototype._handleDisconnect = function (msg) {
    this.emit('disconnect', msg);
    this.stop();
};

module.exports = StreamingAPIConnection;
