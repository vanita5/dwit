var Dwitio = require('../lib/Dwitio');

var D = new Dwitio();

var listener = D.listen.for.dweets.from('your-thing');

listener.on('message', function(msg) {
    console.log(msg);
});

listener.on('error', function(err) {
    console.log(err);
});
