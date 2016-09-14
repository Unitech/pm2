


var pm2 = require('..');

setTimeout(function() {
  pm2.connect(function() {
    pm2.restart('all', function() {
      pm2.disconnect(function() {

      });
    });
  });
}, 3000);
