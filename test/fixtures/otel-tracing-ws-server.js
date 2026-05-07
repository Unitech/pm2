var http = require('http');
var WebSocket = require('ws');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('ok');
});

var wss = new WebSocket.Server({ server: server });

wss.on('connection', function(ws) {
  ws.on('message', function(msg) {
    ws.send('echo:' + msg);
  });
});

server.listen(0, function() {
  var port = server.address().port;

  // Send port back to PM2
  if (process.send) {
    process.send({
      type: 'process:msg',
      data: { port: port }
    });
  }

  // Self-generate HTTP traffic to produce traces
  setInterval(function() {
    var req = http.get('http://localhost:' + port + '/health', function(res) {
      res.on('data', function() {});
      res.on('end', function() {});
    });
    req.on('error', function() {});
  }, 200);
});
