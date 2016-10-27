
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(process.env.PORT || 8000, function() {
  console.log('App listening on port %d in env %s', process.env.PORT || 8000, process.env.NODE_ENV);

  // 1# Notify application ready
  setTimeout(function() {
    process.send('ready');
  }, 200);

});

// 2# Handle on Exit
process.on('SIGINT', function() {
  console.log('Cleanup on exit');
  server.close();

  setTimeout(function() {
    process.exit(0);
  }, 500);
});
