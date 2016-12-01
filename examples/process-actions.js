var pmx = require('pmx');

pmx.action('hello', function(reply) {
  reply({ answer : 'world' });
});

setInterval(function() {
  // Keep application online
}, 100);
