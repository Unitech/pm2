
var axm = require('../../../modules/pm2-io-bpm');

//axm.catchAll();

setTimeout(function() {
  throw new Error('Exit');
}, 200);
