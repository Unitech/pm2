
var Probe = require('pmx').probe();

var i = 0;

var metric = Probe.metric({
  name    : 'Metric',
  value   : function() {
    return i;
  }
});

setInterval(function() {
  i++;
}, 100);


var meter = Probe.meter({
  name    : 'Meter'
});

setInterval(function() {
  meter.mark()
}, 200);

var histo = Probe.histogram({
  name    : 'Histogram'
});

var latency;

setInterval(function() {
  latency = Math.round(Math.random() * 100);
  histo.update(latency);
}, 100);

var counter = Probe.counter({
  name    : 'Counter'
});

setInterval(function() {
  counter.inc()
}, 500);
