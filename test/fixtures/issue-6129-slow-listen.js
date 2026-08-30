// App that is slow to bind its port: in cluster mode the worker is
// status=online (cluster 'online' event) ~2s before it emits 'listening'.
var http = require('http');

setTimeout(function() {
  http.createServer(function(req, res) {
    res.end('ok');
  }).listen(0);
}, 2000);
