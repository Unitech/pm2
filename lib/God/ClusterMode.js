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

    /**
     * Broadcast message to God
     */
    clu.on('message', function cluMessage(msg) {
      /*********************************
       * If you edit this function
       * Do the same in ForkMode.js !
       *********************************/
      if (msg.data && msg.type) {
        return God.bus.emit(msg.type ? msg.type : 'process:msg', {
          at      : Math.round(Date.now() / 1000),
          data    : msg.data,
          process : Common.formatCLU(clu)
        });
      }
      else {
        return God.bus.emit('process:msg', msg);
      }
    });

    return cb(null, clu);
  };
};
