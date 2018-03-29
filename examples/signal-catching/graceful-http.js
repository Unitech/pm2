
var http = require('http');

process.on('SIGINT', function() {
  console.log('Graceful closing...');
  server.close(function() {
    process.exit(0);
  });
});

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(process.env.PORT || 8000, function() {
  console.log('App listening on port %d in env %s', process.env.PORT || 8000, process.env.NODE_ENV);
});
