
var pm2 = require('..');

pm2.connect(function() {
  pm2.delete('all', function() {
    pm2.start('examples/human_event.js', function() {
      pm2.start('examples/child.js', {instances:4},function() {
        pm2.start('examples/custom_action.js',  function() {
          pm2.start('examples/custom_action.js', {execMode : 'fork', force : true}, function() {
            pm2.start('examples/auto-save.js', {execMode : 'fork', watch:true, force : true}, function() {
            pm2.start('examples/custom_action_with_params.js', {name : 'custom'} , function() {
              pm2.start('examples/auto-save.js', {watch : true,force:true, name :'auto-save-modify'}, function() {
                pm2.start('examples/http-trace.js', {name:'trace'}, function() {
                  //pm2.start('examples/auto-bench.js', {instances : 'max'}, function() {
                  pm2.start('examples/throw.js', {name:'auto-throw', execMode : 'cluster_mode'}, function() {
                    pm2.disconnect(function() { process.exit(1); });
                  });
                  //});
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
