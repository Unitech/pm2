
var pm2 = require('../..');

pm2.connect(function() {
  pm2.delete('all', function() {
    pm2.start('examples/axm/pm2_probe.js', function() {
      pm2.start('examples/axm/pm2_agent_probe.js', function() {
        pm2.start('examples/axm/event.js', function() {
          pm2.start('examples/axm/http_app.js', {instances:4},function() {
            pm2.start('examples/axm/probes.js',function() {
              pm2.start('examples/axm/custom_action.js',  function() {
                pm2.start('examples/axm/custom_action_with_params.js', {name : 'custom'} , function() {
                  pm2.start('examples/axm/http_transaction.js', {name:'trace'}, function() {
                    pm2.start('examples/axm/throw.js', {name:'auto-throw', execMode : 'cluster_mode'}, function() {
                      pm2.disconnect(function() { process.exit(1); });
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
});
