
var ipm2 = require('..')();

ipm2.on('ready', function() {
  console.log("READY");

  ipm2.bus.on('*', function(event, data){    
    console.log(event, data.pm2_env.name);
  });

  setTimeout(function() {
    ipm2.rpc.restartProcessId(0, function(err, dt) {
      console.log(dt);
    });
  }, 2000);

  
  ipm2.rpc.getMonitorData({}, function(err, dt) {
    console.log(dt);
  });
});
