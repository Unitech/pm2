
const pmx = require('pmx');
const Probe = pmx.probe();

var metric = Probe.meter({
  name    : 'Meter'
});

setInterval(function() {
  metric.mark()
}, 200);
