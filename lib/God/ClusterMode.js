'use strict';

/**
 * @file Cluster execution functions related
 * @author Alexandre Strzelewicz <as@unitech.io>
 * @project PM2
 */

var cluster       = require('cluster');
var fs            = require('fs');
var cst           = require('../../constants.js');
var util          = require('util');

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function(God) {

  /**
   * For Node apps - Cluster mode
   * It will wrap the code and enable load-balancing mode
   * @method nodeApp
   * @param {} env_copy
   * @param {} cb
   * @return Literal
   */
  God.nodeApp = function(env_copy, cb){
    var clu;

    if (fs.existsSync(env_copy.pm_exec_path) == false) {
      console.error('Script ' + env_copy.pm_exec_path + ' missing');
      return cb(God.logAndGenerateError('Script ' + env_copy.pm_exec_path + ' missing'), {});
    }

    console.log('Entering in node wrap logic (cluster_mode) for script %s', env_copy.pm_exec_path);

    if (env_copy.nodeArgs && Array.isArray(env_copy.nodeArgs)) {
      cluster.settings.execArgv = env_copy.nodeArgs;
    }

    try {
      clu = cluster.fork(env_copy);
    } catch(e) { console.error(e); }

    clu.pm2_env = env_copy;
    God.clusters_db[env_copy.pm_id] = clu;

    // Receive message from child
    clu.on('message', function(msg) {
      switch (msg.type) {
      case 'process:exception':
        God.bus.emit('process:exception', {process : clu, data : msg, err : msg.err});
       break;
      case 'log:out':
        God.bus.emit('log:out', {process : clu, data : msg.data});
        break;
      case 'log:err':
        God.bus.emit('log:err', {process : clu, data : msg.data});
        break;
      case 'human_event':
        God.bus.emit('human_event', {process : clu, data : util._extend(msg, {type:msg.name})});
        break;
      default: // Permits to send message to external from the app
        God.bus.emit(msg.type ? msg.type : 'process:msg', {process : clu, data : msg });
      }
    });

    // Avoid circular dependency
    delete clu.process._handle.owner;

    clu.once('online', function() {
      clu.pm2_env.status = cst.ONLINE_STATUS;
      if (cb) return cb(null, clu);
      return false;
    });
    return false;
  };
};
