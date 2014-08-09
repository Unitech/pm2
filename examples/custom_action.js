
var axm = require('axm');


axm.action('refresh:db2', {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});

axm.action('refresh:db3', {comment : 'Comment'}, function(reply) {
  throw new Error('asdadsadsasd');
  reply({success : false});
});

axm.action('refresh:db', {comment : 'Refresh main database'}, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});
