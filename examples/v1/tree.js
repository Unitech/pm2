
var spawn = require('child_process').spawn,
    grep  = spawn('top', [], { stdio: 'inherit' });


var http = require('http');


var normal = require('child_process').fork('examples/child.js', ['normal']);

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hoy');
}).listen(8010);
