var net = require('net');

var server = net.createServer(function (socket) {
  socket.write('Welcome to the Telnet server of the process' + (process.env.NODE_APP_INSTANCE || 'must be run on pm2'));
}).listen(8888, function() {
  console.log('Listening on port %s', 8888);
});
