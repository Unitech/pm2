var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end("hello world\n");
}).listen(8020);

var spawn = require('child_process').spawn

var a = spawn('tail', ['-F', './childrensdetached.log'], {detached: true, stdio: ['ignore', 'ignore', 'ignore']})
a.unref()
var b = spawn('tail', ['-F', './childrens.log'])

