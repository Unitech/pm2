
var pm2 = require('..');

pm2.connect(function() {
  setInterval(function() {
    pm2.restart('echo', function() {
      console.log(arguments);
    });
  }, 2000);
});
