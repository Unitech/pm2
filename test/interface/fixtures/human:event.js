
var axm = require('axm');

setInterval(function() {
  axm.emit('content:page:created', {
    msg : 'A CMS page has been created',
    user : 'Francois Debiole'
  });
}, 200);
