

var axm = require('pmx');

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
  value : function() {
    return Object.keys(users).length;
  }
});

/**
 * Monitor value
 */
var cheerio = probe.metric({
  name : 'Cheerio',
  value : true
});

/**
 * Meter for HTTP
 */
var meter = probe.meter({
  name    : 'req/min',
  seconds : 60
});

var http  = require('http');

http.createServer(function(req, res) {
  meter.mark();
  res.end('Thanks');
}).listen(5005);

/**
 * Meter example
 */

var meter2 = probe.meter({
  name    : 'random',
  seconds : 1
});

setInterval(function() {
  meter2.mark(Math.random() * 100);
}, 10);


setTimeout(function() {
  cheerio.set(false);
  counter.inc();
}, 1100);

/**
 * Counter
 */

var counter = probe.counter({
  name : 'Downloads'
});

counter.inc();
counter.dec();
counter.inc();
counter.inc();

console.log(cheerio.val());
setInterval(function() {
  console.log(counter.val());
  console.log(meter.val());
  console.log(meter2.val());
  console.log(rt_users.val());
  console.log(cheerio.val());
}, 1500);


axm.catchAll();

axm.action('throw error', function(reply) {
  setTimeout(function() {
    console.log('log message from echo auto kill');
    throw new Error('Exitasdsadasdsda unacepted 222222 !!');
  }, 2000);
});


axm.action('dec', function(reply) {
  counter.dec();
  reply({success : true});
});

axm.action('inc', function(reply) {
  counter.inc();
  reply({success : true});
});

axm.action('do:query', function(reply) {
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
      console.log(data); // I can't parse it because, it's a string. why?
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.end();

  reply({success : true});
});
