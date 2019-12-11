const fs  = require('fs');
const forEachLimit = require('async/forEachLimit');

var cst = require('../../../constants.js');
var Common = require('../../Common.js');

module.exports = function(CLI) {
  /**
   * Monitor Selectively Processes (auto filter in interaction)
   * @param String state 'monitor' or 'unmonitor'
   * @param String target <pm_id|name|all>
   * @param Function cb callback
   */
  CLI.prototype.monitorState = function(state, target, cb) {
    var that = this;

    if (!target) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Please specify an <app_name|pm_id>');
      return cb ? cb(new Error('argument missing')) : that.exitCli(cst.ERROR_EXIT);
    }

    function monitor (pm_id, cb) {
      // State can be monitor or unmonitor
      that.Client.executeRemote(state, pm_id, cb);
    }
    if (target === 'all') {
      that.Client.getAllProcessId(function (err, procs) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        }
        forEachLimit(procs, 1, monitor, function (err, res) {
          return typeof cb === 'function' ? cb(err, res) : that.speedList();
        });
      });
    } else if (!Number.isInteger(parseInt(target))) {
      this.Client.getProcessIdByName(target, true, function (err, procs) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        }
        forEachLimit(procs, 1, monitor, function (err, res) {
          return typeof cb === 'function' ? cb(err, res) : that.speedList();
        });
      });
    } else {
      monitor(parseInt(target), function (err, res) {
        return typeof cb === 'function' ? cb(err, res) : that.speedList();
      });
    }
  };
}
