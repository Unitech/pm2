
var axm = require('../../../modules/pm2-io-bpm');

axm.action('refresh:db', function(reply) {
  console.log('Refreshing');
  reply({success : true, subobj : { a : 'b'}});
});
