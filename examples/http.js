
var http = require('http');
var port = 0;

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end(port + '');
}).listen(process.env.PORT || 8000, function() {
  port = server.address().port;
  console.log('App listening on port %d in env %s', server.address().port, process.env.NODE_ENV);

  // 1# Notify application ready
  setTimeout(function() {
    process.send('ready');
  }, 2000);

});

// // 2# Handle on Exit
process.on('SIGINT', function() {
  console.log('Cleanup on exit');

  server.on('close', function() {
    console.log('Connections closed');
    process.exit(0);
  });

  server.close();
});
