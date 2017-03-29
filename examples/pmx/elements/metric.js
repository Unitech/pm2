
const pmx = require('pmx');
const Probe = pmx.probe();

var data = 10;

var metric = Probe.metric({
  name    : 'Realtime user',
  value   : function() {
    return data;
  }
});

setInterval(function() {
  data = Math.random();
}, 500);
