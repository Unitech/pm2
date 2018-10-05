
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8008, function() {
  console.log('App listening on port %d', server.address().port);
});
