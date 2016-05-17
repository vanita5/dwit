var D = require('./dweetio')();

var Dwitio = function() {
    if (!(this instanceof Dwitio)) {
        return new Dwitio();
    }
};

Dwitio.prototype.lock = function(thing, params, cb) {
    params = params || {};
    D.get('lock/' + thing, params, function(err, data, response) {
        cb(err, data, response);
    });
};

Dwitio.prototype.unlock = function(thing, params, cb) {
    params = params || {};
    D.get('unlock/' + thing, params, function(err, data, response) {
        cb(err, data, response);
    });
};

Dwitio.prototype.remove = {
    lock: function(thing, params, cb) {
        params = params || {};
        D.get('remove/lock/' + thing, params, function(err, data, response) {
            cb(err, data, response);
        });
    },
    alert: {
        for: function(thing, params, cb) {
            params = params || {};
            D.get('remove/alert/for/' + thing, params, function(err, data, response) {
                cb(err, data, response);
            });
        }
    }
};

Dwitio.prototype.dweet = {
    for: function(thing, params, cb) {
        D.post('dweet/for/' + thing, params, function(err, data, response) {
            cb(err, data, response);
        });
    },
    quietly: {
        for: function(thing, params, cb) {
            D.post('dweet/quietly/for/' + thing, params, function(err, data, response) {
                cb(err, data, response);
            });
        }
    }
};

Dwitio.prototype.get = {
    latest: {
        dweet: {
            for: function(thing, params, cb) {
                params = params || {};
                D.get('get/latest/dweet/for/' + thing, params, function(err, data, response) {
                    cb(err, data, response);
                });
            }
        }
    },
    dweets: {
        for: function(thing, params, cb) {
            params = params || {};
            D.get('get/dweets/for/' + thing, params, function(err, data, response) {
                cb(err, data, response);
            });
        }
    },
    stored: {
        dweets: {
            for: function(thing, params, cb) {
                params = params || {};
                D.get('get/stored/dweets/for/' + thing, params, function(err, data, response) {
                    cb(err, data, response);
                });
            }
        },
        alerts: {
            for: function(thing, params, cb) {
                params = params || {};
                D.get('get/stored/alerts/for/' + thing, params, function(err, data, response) {
                    cb(err, data, response);
                });
            }
        }
    },
    alert: {
        for: function(thing, params, cb) {
            params = params || {};
            D.get('get/alert/for/' + thing, params, function(err, data, response) {
                cb(err, data, response);
            });
        }
    }
};

Dwitio.prototype.listen = {
    for: {
        dweets: {
            from: function(thing, params) {
                params = params || {};
                return D.stream('listen/for/dweets/from/' + thing);
            }
        }
    }
};

Dwitio.prototype.alert = function(who, thing, condition, params, cb) {
    params = params || {};
    D.get('alert/' + who + '/when/' + thing + '/' + condition, params, function(err, data, response) {
        cb(err, data, response);
    });
};

module.exports = Dwitio;
