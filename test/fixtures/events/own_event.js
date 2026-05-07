
var axm = require('../../../modules/pm2-io-bpm');

setInterval(function() {
  axm.emit('user:register', {
    user : 'toto@gmail.com',
    mail : 'hey@gmail.com'
  });
}, 200);
