

var axm = require('../..');

axm.catchAll();

setTimeout(function() {
  throw new Error('global error');
}, 200);
