
var http = require('http');

setInterval(function() {
  // Do nothing to keep process alive
}, 1000);

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(0);

process.on('SIGINT', function () {
  console.log('SIGINT cb called but forbid exit');
});
