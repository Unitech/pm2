
var pmx = require('pmx');

pmx.action('exception', function(reply) {
  setTimeout(function() {
    console.log('Im going to crash');
    console.log('I will crash muhahah');
    throw new Error('CRASHED');
  }, 100);

  return reply({ sucess: true});
});

setInterval(function() {
}, 1000);
