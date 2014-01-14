
/*
 * Example of graceful exit
 *
 * $ pm2 gracefulReload all
 */

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    console.log('Closing all connections...');
    setTimeout(function() {
      console.log('Finished closing connections');
      process.exit(0);
    }, 1500);
  }
});

var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8000, function() {
  console.log('listening');
});
