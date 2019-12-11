
var axm = require('@pm2/io');

setInterval(function() {

  axm.emit('content:page:created', {
    msg : 'A CMS page has been created',
    user : 'Francois Debiole'
  });

}, 1000);
