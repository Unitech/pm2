
var pm2      = require('../..');

var params = JSON.parse(process.env.fork_params);

console.log('Executing: pm2 %s %s', params.action, params.opts.name);

pm2.connect(function() {
  pm2.remote(params.action, params.opts, function(err, dt) {
    process.send(JSON.stringify({err: err, dt: dt}));
    pm2.disconnect(process.exit);
  });
});
