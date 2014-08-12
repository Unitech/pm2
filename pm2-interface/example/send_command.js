
var ipm2 = require('..');

var ipm2a = ipm2({bind_host : 'localhost'});



ipm2a.on('ready', function() {
  console.log('Connected to pm2');

  ipm2a.bus.on('*', function(event, data){
    console.log(event);
  });

  setInterval(function() {

    var msg = {type:"god:heap"};

    ipm2a.rpc.msgProcess({name:"expose_method", msg:msg}, function (err, res) {
      if (err) console.log(err)
      else console.log(res)
      console.log(arguments);
    })

  }, 2000);

});
