
var axm = require('axm');

axm.action('refresh:db', {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});
