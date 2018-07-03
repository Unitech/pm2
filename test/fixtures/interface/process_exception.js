
var axm = require('@pm2/io');

axm.catchAll();

setTimeout(function() {
  throw new Error('Exit');
}, 200);
