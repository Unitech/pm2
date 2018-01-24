var assert = require('assert')
  , s = new Set()
  ;

s.add('a');

assert.ok(s.has('a'));

setInterval(function() {
  console.log(s.has('a'));
}, 1000);
