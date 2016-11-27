
var pmx = require('pmx');

pmx.action('example', function(reply) {
  reply({success:true});
});

setInterval(function() {
  // Do not auto exit on empty event loop
}, 1000);
