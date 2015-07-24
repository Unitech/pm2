
var Transport = require('./utils/transport.js');
var debug = require('debug')('axm:monitor');

var Monitor = {};

function cookData(data) {
  var cooked_data = {};

  Object.keys(data).forEach(function(probe_name) {
    if (typeof(data[probe_name]) == 'function')
      cooked_data[probe_name] = data[probe_name]();
    else
      cooked_data[probe_name] = data[probe_name];
  });
  return cooked_data;
};

function enableProbes(custom_namespace) {
  if (!custom_namespace)
    custom_namespace = 'axm';

  if (!global[custom_namespace])
    global[custom_namespace] = {};

  if (this.interval)
    return global[custom_namespace];

  this.interval = setInterval(function() {
    Transport.send({
      type : 'axm:monitor',
      data : cookData(global[custom_namespace])
    });
  }, 990);

  return global[custom_namespace];
};

function stopProbing() {
  clearInterval(this.interval);
}

Monitor.enableProbes = enableProbes;
Monitor.enableProbe = enableProbes;

Monitor.stopProbe = stopProbing;
Monitor.stopProbes = stopProbing;

module.exports = Monitor;
