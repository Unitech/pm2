
require('@pm2/io').init({
  http : true
});

var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8000);
