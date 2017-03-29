

const pmx = require('pmx');
const Probe = pmx.probe();

var metric = Probe.counter({
  name    : 'Counter'
});

setInterval(function() {
  metric.inc()
}, 500);
