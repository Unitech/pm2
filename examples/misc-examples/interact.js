
var pm2 = require('..');

var MACHINE_NAME = 'hk1';
var PRIVATE_KEY  = 'z1ormi95vomgq66';
var PUBLIC_KEY   = 'oa0m7nuhdfibi16';

pm2.connect(true, function() {
  pm2.start({
    script : '../test/fixtures/child.js',
    name : 'production-app'
  }, function() {
    pm2.interact(PRIVATE_KEY, PUBLIC_KEY, MACHINE_NAME, function() {
    });
  });
});
