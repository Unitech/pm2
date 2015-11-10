
var axm = require('..');

axm.action('test:nab', {comment : 'This is a test', display : true}, function(reply) {
  console.log('CHILD: Action test called from external process');
  reply({ res : 'hello moto'});
});
