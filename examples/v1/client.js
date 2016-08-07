

var Wrap = require('./wrap.js');
var axon = require('pm2-axon');

var Module = require('module');
Wrap.wrap(Module, '_load', function(load) {
  return function(file) {
    return load.apply(this, arguments);
  }
});


var server = axon.socket('sub');

server.bind(8080);

server.on('bind', function() {
  console.log('Server ready');
});

server.on('message', function(data) {
  console.log(data);
});

// setTimeout(function() {
//   console.log('Closing server');
//   server.close(function() {
//     console.log('Closed');
//   });
// }, 3000);

function setupConnection() {
  var client = axon.socket('pub');

  client.on('connect', function() {
    console.log('Client connected');
  });

  client.on('error', function(e) {
    console.log('Client got error', e.message);
  });

  client.on('close', function(e) {
    console.log('Client got a close');
  });

  client.on('reconnect attempt', function(e) {
    console.log('Reconnecting');
  });

  client.connect(8080);

  this.send = function() {
    client.send({success:true});
  };

  this.destroy = function() {
    client.close();
    client.removeAllListeners();
  };

  this.reconnect = function() {

  };
  return this;
}

var connection = setupConnection();

setInterval(function() {
  connection.send();
}, 1000);

setInterval(function() {
  connection.destroy();
  connection = setupConnection();
}, 2000);
