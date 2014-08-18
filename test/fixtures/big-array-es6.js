

var obj = {};
var i = 0;

setInterval(function() {
  obj[i] = Array.apply(null, new Array(99999)).map(String.prototype.valueOf,"hi");
  i++;
}, 2);


(function testHarmony() {
  //
  // Harmony test
  //
  try {
    var assert = require('assert')
    , s = new Set();
    s.add('a');
    assert.ok(s.has('a'));
    console.log('● ES6 mode'.green);
  } catch(e) {}
})();
