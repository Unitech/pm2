
var axm = require('../../../modules/pm2-io-bpm');

setInterval(function() {
  axm.emit('content:page:created', {
    msg : 'A CMS page has been created',
    user : 'Francois Debiole'
  });
}, 200);
