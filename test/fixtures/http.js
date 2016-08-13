
var http = require('http');

var app = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
})

var listener = app.listen(0, function() {
  console.log('Listening on port ' + listener.address().port);
});

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    console.log('Closing all connections...');
    setTimeout(function() {
      console.log('Finished closing connections');
      process.exit(0);
    }, 100);
  }
});
