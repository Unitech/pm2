
var axm = require('axm');

axm.catchAll();

setTimeout(function() {
  throw new Error('Exit');
}, 200);
