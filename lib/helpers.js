var querystring = require('querystring');
var request = require('request');

exports.makeQueryString = function (obj) {
    var qs = querystring.stringify(obj);
    qs = qs.replace(/\!/g, "%21")
        .replace(/\'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
    return qs
};

exports.moveParamsIntoPath = function (params, path) {
    var rgxParam = /\/:(\w+)/g;
    var missingParamErr = null;

    path = path.replace(rgxParam, function (hit) {
        var paramName = hit.slice(2);
        var suppliedVal = params[paramName];
        if (!suppliedVal) {
            throw new Error('Twit: Params object is missing a required parameter for this request: `'+paramName+'`');
        }
        var retVal = '/' + suppliedVal;
        delete params[paramName];
        return retVal;
    });
    return path;
};

exports.attachBodyInfoToError = function (err, body) {
    err.twitterReply = body;
    if (!body) {
        return;
    }
    if (body.error) {
        // the body itself is an error object
        err.message = body.error;
        err.allErrors = err.allErrors.concat([body]);
    } else if (body.errors && body.errors.length) {
        // body contains multiple error objects
        err.message = body.errors[0].message;
        err.code = body.errors[0].code;
        err.allErrors = err.allErrors.concat(body.errors);
    }
};

exports.makeDweetError = function (message) {
    var err = new Error();
    if (message) {
        err.message = message;
    }
    err.code = null;
    err.allErrors = [];
    err.twitterReply = null;
    return err;
};
