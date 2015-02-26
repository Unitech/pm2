
var axm = require('pmx');

setInterval(function() {
  axm.emit('user:register', {
    user : 'toto@gmail.com',
    mail : 'hey@gmail.com'
  });
}, 200);
