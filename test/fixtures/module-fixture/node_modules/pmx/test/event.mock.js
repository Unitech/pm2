
var axm = require('..');

setInterval(function() {
  axm.emit('test', {
    user : 'toto',
    subobj : {
      subobj : {
        a : 'b'
      }
    }
  });
}, 100);
