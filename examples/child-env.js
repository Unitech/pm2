
var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end(process.env.PORT_ENV);
}).listen(process.env.PORT_ENV);
