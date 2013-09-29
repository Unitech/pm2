
var ipm2 = require('..')();


//console.log('wtf', ipm2);

ipm2.on('ready', function() {
  console.log("READY");

  ipm2.rpc.getMonitorData({}, function(err, dt) {
    console.log(dt);
  });
});
