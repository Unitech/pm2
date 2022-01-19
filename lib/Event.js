/**
 * Copyright 2013-2022 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var Utility       = require('./Utility.js');

module.exports = function(God) {

  God.notify = function(action_name, data, manually) {
    God.bus.emit('process:event', {
      event      : action_name,
      manually   : typeof(manually) == 'undefined' ? false : true,
      process    : Utility.formatCLU(data),
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
      process    : Utility.formatCLU(proc),
      at         : Utility.getDate()
    });

    process.nextTick(function() {
      return cb ? cb(null) : false;
    });
    return false;
  };
};
