
var axm = require('@pm2/io');

setInterval(function() {
  axm.emit('user:register', {
    user : 'toto@gmail.com',
    mail : 'hey@gmail.com'
  });
}, 200);
