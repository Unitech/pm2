
var numCPUs = require('os').cpus().length;
var cluster = require('cluster');
var punt = require('punt');

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  var server = punt.bind('0.0.0.0:5000');

  server.on('message', function(msg){
    console.log(msg);
  });


  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
  });
} else {
  var a = punt.connect('0.0.0.0:5000');

  setInterval(function(){
    a.send({ hello: 'world' });
  }, 150);
}
