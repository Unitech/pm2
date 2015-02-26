
var axm = require('pmx');

axm.action('refresh:db', function(reply) {
  console.log('Refreshing');
  reply({success : true});
});
