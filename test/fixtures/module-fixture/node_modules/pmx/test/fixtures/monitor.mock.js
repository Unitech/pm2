
var axm = require('../..');

var obj = axm.enableProbes();

var i = 2;

obj.it_works = true;
obj.value = 20;
obj.i = i;

setTimeout(function() {
  i = 4;
  obj.it_works = false;
  obj.value = 99;

  setTimeout(function() {
    axm.stopProbes();
  }, 1100);
}, 1100);
