
var pm2 = require('../..');

pm2.connect(function() {
  pm2.delete('all', function() {
    pm2.start('examples/keymetrics-integration/pm2_probe.js', function(err) {
      pm2.start('examples/keymetrics-integration/event.js', {force:true}, function() {
        pm2.start('examples/keymetrics-integration/http_app.js', {force:true, instances:4},function() {
          pm2.start('examples/keymetrics-integration/probes.js',function() {
            pm2.start('examples/keymetrics-integration/custom_action.js', {force:true},  function() {
              pm2.start('examples/keymetrics-integration/custom_action_with_params.js', {force:true, name : 'custom'} , function() {
                pm2.start('examples/keymetrics-integration/http_transaction.js', {name:'trace', force:true}, function() {
                  pm2.start('examples/keymetrics-integration/throw.js', {name:'auto-throw', execMode : 'cluster_mode', force:true}, function() {
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
