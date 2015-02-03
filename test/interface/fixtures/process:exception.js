
var axm = require('pmx');

axm.catchAll();

setTimeout(function() {
  throw new Error('Exit');
}, 200);
