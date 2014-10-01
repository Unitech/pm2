
var Common        = require('./Common');

var Utility       = require('./Utility.js');

var Event = module.exports = {};

module.exports = function ForkMode(God) {

  God.notify = function(action_name, data, manually) {
    God.bus.emit('process:event', {
      event      : action_name,
      manually   : typeof(manually) == 'undefined' ? false : true,
      process    : Common.formatCLU(data),
      at         : Utility.getDate()
    });
  };

  God.notifyByProcessId = function(opts, cb) {
    if (typeof(opts.id) === 'undefined') { return cb(new Error('process id missing')); }
    var proc = God.clusters_db[opts.id];
    if (!proc) { return cb(new Error('process id doesnt exists')); }

    God.bus.emit('process:event', {
      event      : opts.action_name,
      manually   : typeof(opts.manually) == 'undefined' ? false : true,
      process    : Common.formatCLU(proc),
      at         : Utility.getDate()
    });

    process.nextTick(function() {
      return cb ? cb(null) : false;
    });
    return false;
  };
};
