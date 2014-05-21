
var axm = require('axm');

setInterval(function() {
  axm.emit('user:register', {
    user : 'toto@gmail.com',
    mail : 'hey@gmail.com'
  });
}, 200);
