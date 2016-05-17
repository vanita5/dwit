# Dwit

[Dweet.io](https://dweet.io) API Client for node.

Quick and dirty implementation of the **REST** and **Streaming API** mostly copied from [twit](https://github.com/ttezel/twit).

And it comes with it's own API schema inspired by the dweet.io API.

## Install

```bash
npm install dwitio
```

## Usage

### Dweet.io API

```node
var D = require('../lib/Dwitio')();

/**
 * Get latest tweet for a thing
 */
 D.get.latest.dweet.for('your-thing', { key: '' }, function(err, data, response) {
     console.log(data);
 });
 
 /**
  * Update a thing
  */
 D.dweet.for('your-thing', { content: { yourValue: 1 } }, function(err, data, response) {
     console.log(data);
 });
 
 
 /**
  * Start a stream/listener for a thing
  */
var listener = D.listen.for.dweets.from('your-thing');

listener.on('message', function(msg) {
    console.log(msg);
});

listener.on('error', function(err) {
    console.log(err);
});
 
```

### Twit API

```node
var D = require('../lib/dweetio')();

/**
 * Get latest tweet for a thing
 */
D.get('get/latest/dweet/for/you-thing', { key: '' }, function(err, data, response) {
    console.log(data);
});
 
/**
 * Update a thing
 */
D.post('dweet/for/your-thing', { content: { yourValue: 1 } }, function(err, data, response) {
    console.log(data);
});
 
 
/**
 * Start a stream/listener for a thing
 */
var listener = return D.stream('listen/for/dweets/from/your-thing');

listener.on('message', function(msg) {
    console.log(msg);
});

listener.on('error', function(err) {
    console.log(err);
});

```

## License

```
(The MIT License)

Copyright (c) 2016 vanita5 <mail@vanit.as>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
