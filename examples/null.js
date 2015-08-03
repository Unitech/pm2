var pmx = require('pmx');
var http  = require('http');

http.createServer(function(req, res) {
      res.end('Thanks');
  }).listen(5445);

pmx.action('db:test', {comment: 'Simply test'}, function(reply) {
      reply({test: "WOWOWOWOWOW", length: 12});
  });

pmx.action('throw', {comment: 'Simply test'}, function(reply) {
  throw { success : 'false', length: 12 };
});
