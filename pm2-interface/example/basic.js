var ipm2 = require('..');

var ipm2a = ipm2({bind_host : 'localhost'});



ipm2a.on('ready', function() {
  console.log('Connected to pm2');

  ipm2a.bus.on('*', function(event, data){
    console.log(event);
  });

  // ipm2a.bus.on('log:err', function(event, data){
  //   console.log(event, data);
  // });

  // ipm2a.bus.on('log:out', function(event, data){
  //   console.log(event, data);
  // });


  ipm2a.on('rpc_sock:reconnecting', function() {
    console.log('rpc_sock:reconnecting');
  });
  ipm2a.on('sub_sock:ready', function() {
    console.log('sub_sock:ready');
  });
  ipm2a.on('sub_sock:closed', function() {
    console.log('sub_sock:closed');
  });

  ipm2a.on('sub_sock:reconnecting', function() {
    console.log('sub_sock:reconnecting');
  });


  // setTimeout(function() {
  //   ipm2.rpc.restartProcessId(0, function(err, dt) {
  //     console.log(dt);
  //   });
  // }, 2000);


  // ipm2.rpc.getMonitorData({}, function(err, dt) {
  //   console.log(dt);
  // });
});
