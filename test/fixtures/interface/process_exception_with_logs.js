
var pmx = require('pmx');

pmx.action('exception', function(reply) {
  console.log('Im going to crash');
  console.log('I will crash muhahah');
  throw new Error('CRASHED');

  return reply({ sucess: true});
});

setInterval(function() {
}, 1000);
