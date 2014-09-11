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
var Common        = require('../Common');

/**
 * Description
 * @method exports
 * @param {} God
 * @return
 */
module.exports = function ClusterMode(God) {

  /**
   * For Node apps - Cluster mode
   * It will wrap the code and enable load-balancing mode
   * @method nodeApp
   * @param {} env_copy
   * @param {} cb
   * @return Literal
   */
  God.nodeApp = function nodeApp(env_copy, cb){
    var clu = null;

    // if (fs.existsSync(env_copy.pm_exec_path) == false) {
    //   return cb(God.logAndGenerateError('Script ' + env_copy.pm_exec_path + ' missing'), {});
    // }

    console.log('Starting execution sequence in -cluster mode- for app name:%s id:%s',
                env_copy.name,
                env_copy.pm_id);

    if (env_copy.node_args && Array.isArray(env_copy.node_args)) {
      cluster.settings.execArgv = env_copy.node_args;
    }

    try {
      clu = cluster.fork(env_copy);
    } catch(e) {
      God.logAndGenerateError(e);
      return cb(e);
    }

    clu.pm2_env = env_copy;

    // Receive message from child
    clu.on('message', function cluMessage(msg) {
      var proc_data = Common.serialize(clu);

      switch (msg.type) {
      case 'process:exception':
        God.bus.emit('process:exception', {process : proc_data, data : msg, err : msg.err});
        break;
      case 'log:out':
        God.bus.emit('log:out', {process : proc_data, data : msg.data});
        break;
      case 'log:err':
        God.bus.emit('log:err', {process : proc_data, data : msg.data});
        break;
      case 'human_event':
        God.bus.emit('human_event', {process : proc_data, data : util._extend(msg, {type:msg.name})});
        break;
      default: // Permits to send message to external from the app
        God.bus.emit(msg.type ? msg.type : 'process:msg', {process : proc_data, data : msg });
      }
    });

    return cb(null, clu);
  };
};
