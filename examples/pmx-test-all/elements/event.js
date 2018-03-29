
const pmx = require('pmx');

setInterval(function() {
  pmx.emit('user:register', {
    user : 'Alex registered',
    email : 'thorustor@gmail.com'
  });
}, 200);
