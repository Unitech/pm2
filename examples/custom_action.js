
var axm = require('axm');

axm.action('refresh:db', function(reply) {
  console.log('Refreshing');
  reply({success : true});
});
