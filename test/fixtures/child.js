
var http = require('http');
var i = 0;

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end("hello world\n" + i++);
}).listen(8004);
