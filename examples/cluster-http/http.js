
var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  console.log(`New query`)
  res.end('hey');
}).listen(process.env.PORT || 8089, '0.0.0.0', function() {
  console.log('App listening on port 8089');
});
