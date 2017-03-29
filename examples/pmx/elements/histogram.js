

const pmx = require('pmx');
const Probe = pmx.probe();

var metric = Probe.histogram({
  name    : 'Histogram'
});

var latency;

setInterval(function() {
  latency = Math.round(Math.random() * 100);
  metric.update(latency);
}, 100);
