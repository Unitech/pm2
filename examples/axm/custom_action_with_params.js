
var axm = require('axm');

axm.action('refresh:db', { comment : 'Refresh the database' }, function(reply) {
  console.log('Refreshing');
  reply({success : true});
});

axm.action('chanme:ladb', { comment : 'Refresh la BIG database' }, function(reply) {
  console.log('Refreshing BIG DB');
  reply({success : true});
});

axm.action('rm:rf', { comment : 'Delete moi ca plus vite que ca !' }, function(reply) {
  console.log('RMING RFING');
  reply({success : true});
});

axm.action('rm:roff', function(reply) {
  console.log('RMING RFING');
  reply({success : true});
});
