

var axm = require('..');

axm.action('test:with:options', function(options, reply) {
  console.log('CHILD: Action test called from external process');
  reply({ res : 'hello moto', options : options});
});
