

var axm = require('../..');

var probe = axm.probe();

var histogram = probe.histogram({
  name : 'test',
  measurement : 'p95',
  agg_type: 'sum'
});

var a = 0;

setInterval(function() {
  a = Math.round(Math.random() * 100);
  histogram.update(a);
}, 100);

var h2 = probe.histogram({
  name : 'mean',
  measurement : 'mean',
  unit : 'ms'
});

var b = 0;

setInterval(function() {
  b = Math.round(Math.random() * 100);
  h2.update(b);
}, 100);


var h3 = probe.histogram({
  name : 'min',
  measurement : 'min',
  agg_type: 'min'
});

var c = 0;

setInterval(function() {
  c = Math.round(Math.random() * 100);
  h3.update(c);
}, 100);
