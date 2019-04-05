

var pmx = require('@pm2/io');
var conf = pmx.init();

var http = require('http');

http.createServer(function(req, res) {
  res.writeHead(200);
  res.end('hey');
}).listen(8000);


var value_to_inspect = 0;

/**
 * .metric, .counter, .meter, .histogram are also available (cf doc)
 */
var val = pmx.metric({
  name : 'test-probe',
  value : function() {
    return value_to_inspect;
  },
  /**
   * Here we set a default value threshold, to receive a notification
   * These options can be overriden via Keymetrics or via pm2
   * More: http://bit.ly/1O02aap
   */
  alert : {
    mode     : 'threshold',
    value    : 20,
    msg      : 'test-probe alert!',
    action   : function(val) {
      // Besides the automatic alert sent via Keymetrics
      // You can also configure your own logic to do something
      console.log('Value has reached %d', val);
    }
  }
});

setInterval(function() {
  // Then we can see that this value increase over the time in Keymetrics
  value_to_inspect++;
}, 30);

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    console.log('Closing all connections...');
    setTimeout(function() {
      console.log('Finished closing connections');
      process.exit(0);
    }, 500);
  }
});
