

var pmx = require('pmx').init({
  http : true
});

var probe = pmx.probe();

var http = require('http');

var server = http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8000, function() {
  console.log('App listening on port 8000');
});
