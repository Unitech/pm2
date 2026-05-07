
var pmx = require('../../../modules/pm2-io-bpm');

pmx.action('ping', function(reply) {
  return reply({ 'pong' : 'hehe' })
});

pmx.action('param', function(data, reply) {
  return reply(data)
});

setInterval(function() {
}, 1000);
