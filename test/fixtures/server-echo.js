var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end("hello world\n");
}).listen(8020, function() {
	console.log('Server is listenning on port '+8020);
});
