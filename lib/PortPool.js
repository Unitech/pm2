
var port = 20000;

var PortPool = module.exports = {};

PortPool.getAvailablePort = function() {
  return port++;
}

PortPool.startWorker = function() {
  setInterval(function() {

  }, 2000);
}
