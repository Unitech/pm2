

var axm = require('../..');

var obj = axm.enableProbes();

var a = {
  'aaa' : { 'ok' : true },
  'bbb' : { 'ok' : false }
};

// Does not refresh because it copies the val
obj.count = Object.keys(a).length;

obj.countFn = function() {
  return Object.keys(a).length;
};

setTimeout(function () {
  a.ccc = 'test';
  a.ddd = 'test';

  setTimeout(function () {
    axm.stopProbes();
  }, 1100);
}, 1100);
