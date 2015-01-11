var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end("hello world\n");
  console.log("App 2 is running...");
}).listen(8040);
