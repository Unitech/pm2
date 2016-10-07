
var pm2 = require('../..');

pm2.connect(function() {
  console.log('Connected to PM2');
  pm2.delete('all', function() {
    console.log('All processes deleted');
    pm2.start('./pm2_probe.js', function(err) {
      if (err) console.error(err);
      pm2.start('./event.js', {force:true}, function() {
        pm2.start('./http_app.js', {force:true, instances:4},function() {
          pm2.start('./probes.js',function() {
            pm2.start('./custom_action.js', {force:true},  function() {
              pm2.start('./custom_action_with_params.js', {force:true, name : 'custom'} , function() {
                pm2.start('./http_transaction.js', {name:'trace', force:true}, function() {
                  pm2.start('./throw.js', {name:'auto-throw', execMode : 'cluster_mode', force:true}, function() {
                    console.log('All applications have been started');
                    pm2.disconnect(function() {  });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
