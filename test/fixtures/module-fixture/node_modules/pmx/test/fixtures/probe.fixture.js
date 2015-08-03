
var axm = require('../..');

var probe = axm.probe();

var users = {
  'alex'  : 'ok',
  'musta' : 'fa'
};

/**
 * Monitor synchronous return of functions
 */
var rt_users = probe.metric({
  name : 'Realtime user',
  agg_type: 'max',
  value : function() {
    return Object.keys(users).length;
  }
});

/**
 * Monitor value
 */

var config_example = {
  val : 'hey',
  test : {
    a : 'good',
    sign : 'healthy'
  }
}

var cheerio = probe.metric({
  name : 'Cheerio',
  value : function() {
    return config_example;
  }
});

/**
 * Monitor value
 */


// probe.transpose('docker_config', config_example);

probe.transpose({
  name : 'style_2_docker_config',
  data : function doSomething() {
    return config_example;
  }
});

probe.transpose('style_1_docker_config', function doSomething() {
  return config_example;
});


/**
 * Meter for HTTP
 */
var meter = probe.meter({
  name    : 'req/min',
  agg_type: 'min',
  seconds : 60
});

var http  = require('http');

http.createServer(function(req, res) {
  meter.mark();
  res.end('Thanks');
}).listen(3400);

/**
 * Meter example
 */

var meter2 = probe.meter({
  name    : 'random',
  unit    : 'rd',
  agg_type: 'sum',
  seconds : 1
});

setInterval(function() {
  meter2.mark(Math.random() * 100);
}, 10);


setTimeout(function() {
  counter.inc();
  config_example = { yes : true };
}, 1100);

/**
 * Counter
 */

var counter = probe.counter({
  name : 'Downloads',
  agg_type: 'max'
});

counter.inc();
counter.dec();
counter.inc();
counter.inc();

// console.log(cheerio.val());
// setInterval(function() {
//   console.log(counter.val());
//   console.log(meter.val());
//   console.log(meter2.val());
//   console.log(rt_users.val());
//   console.log(cheerio.val());
// }, 1500);
