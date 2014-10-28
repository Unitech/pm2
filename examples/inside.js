
var pm2 = require('..');

pm2.connect(function() {
  setInterval(function() {
    pm2.restart('0', function() {
      console.log(arguments);
    });
  }, 2000);
});
