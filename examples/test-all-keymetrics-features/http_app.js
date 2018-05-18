

var io = require('@pm2/io').init({ http : true });
var probe = io.probe();

var http  = require('http');

/**
 * Probe system #3 - Meter
 *
 * Probe things that are measured as events / interval.
 */
var meter = probe.meter({
  name    : 'req/min',
  seconds : 60
});


http.createServer(function(req, res) {
  // Then mark it at every connections
  meter.mark();
  setTimeout(function() {
    res.end('Thanks');
  }, 500);
}).listen(5005);

function doRequest() {
  var options = {
    hostname : '127.0.0.1',
    port     : 5005,
    path     : '/users',
    method   : 'GET',
    headers  : { 'Content-Type': 'application/json' }
  };

  var req = http.request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (data) {
      console.log(data);
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.end();

}

setInterval(function() {
  doRequest();
}, 1000);
process.on('message', function(msg) {
  if (msg == 'shutdown') {
    console.log('Closing all connections...');
    setTimeout(function() {
      console.log('Finished closing connections');
      process.exit(0);
    }, 500);
  }
});
