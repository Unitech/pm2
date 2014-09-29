

var pm2 = require('..');

pm2.connect(function() {
  pm2.delete('all', function() {
    pm2.start('examples/human_event.js', function() {
      pm2.start('examples/child.js', {instances:2},function() {
        pm2.start('examples/kill-not-so-fast.js',  {
          instances:10,
          minUptime: 0,
          force:true,
          maxRestarts : 0
        },  function() {
          pm2.start('examples/auto-save.js', {execMode : 'fork', watch:true, force : true}, function() {
            pm2.start('examples/custom_action_with_params.js', function() {
              //pm2.start('examples/auto-bench.js', {instances : 'max'}, function() {
              pm2.start('examples/throw.js', {force:true, name:'auto-throw'}, function() {
                pm2.disconnect(function() { process.exit(1); });
              });
            });

          });
        });
      });

    });
  });
});
