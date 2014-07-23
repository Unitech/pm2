
var axm = require('axm');
axm.http();
var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hoy');
}).listen(8000);
