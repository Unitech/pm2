
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(process.env.PORT || 8000, function() {
  console.log('App listening on port %d in env %s', process.env.PORT || 8000, process.env.NODE_ENV);

  // 4# Do not send ready event when TEST_VAR=TIMEOUT
  if (process.env.TEST_VAR !== 'TIMEOUT') {
    setTimeout(function() {
      // 1# Notify application ready
      process.send('ready');
    }, 500);
  }
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

// 3# Throw when TEST_VAR=THROW
if (process.env.TEST_VAR === 'THROW') {
  throw new Error('An Error Occured');
}
