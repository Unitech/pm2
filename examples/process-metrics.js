
var Probe = require('pmx').probe();

var counter = 0;

var metric = Probe.metric({
  name    : 'Counter',
  value   : function() {
    return counter;
  }
});

setInterval(function() {
  counter++;
}, 100);
