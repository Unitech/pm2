var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('ok');
});

server.listen(0, function() {
  var port = server.address().port;

  // Send port back to PM2 so the test can make external HTTP requests
  if (process.send) {
    process.send({
      type: 'process:msg',
      data: { port: port }
    });
  }

  // Self-generate HTTP traffic to trigger traces
  setInterval(function() {
    var req = http.get('http://localhost:' + port + '/test', function(res) {
      res.on('data', function() {});
      res.on('end', function() {});
    });
    req.on('error', function() {});
  }, 200);
});
