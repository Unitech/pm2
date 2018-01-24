

var pm2 = require('..');

pm2.connect(function() {
  pm2.start(__dirname + '/args.js', {
    scriptArgs : ['-i', 'sisi', '-x', 'toto']
  }, function(err, res) {
    console.log(arguments);
  });
});
