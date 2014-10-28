
var axm = require('axm');

var probe = axm.enableProbes();

probe.my_value = 56;

probe.is_working = true;

setInterval(function() {
  probe.my_value++;
}, 1000);
