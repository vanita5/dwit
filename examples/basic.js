var Dwitio = require('../lib/Dwitio');

var D = new Dwitio();

D.get.latest.dweet.for('your-thing', { key: '' }, function(err, data, response) {
    console.log(data);
});

D.dweet.for('your-thing', { content: { yourValue: 1 } }, function(err, data, response) {
    console.log(data);
});
