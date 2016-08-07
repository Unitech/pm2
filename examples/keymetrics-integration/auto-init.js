

var pmx = require('pmx').init();

var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8005);

pmx.action('refresh:db2', {comment : 'Refresh main database'}, function(reply) {
  throw new Error('hey');
});
