
var pm2 = require('..');

pm2.connect(function() {

  pm2.start('echo.js', function() {

    setInterval(function() {
      pm2.restart('echo', function() {
      });
    }, 2000);

  });


});

pm2.launchBus(function(err, bus) {
  console.log('connected', bus);

  bus.on('log:out', function(data) {
    if (data.process.name == 'echo')
      console.log(arguments);
  });

  bus.on('reconnect attempt', function() {
    console.log('Bus reconnecting');
  });

  bus.on('close', function() {
    console.log('Bus closed');
  });

});

/**
 * Exiting
 */
//pm2.disconnectBus(); // For Bus system
//pm2.disconnect();    // For RPC connection
