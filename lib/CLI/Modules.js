
/***************************
 *
 * Module methods
 *
 **************************/

var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var Modularizer = require('../Modularizer.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');

module.exports = function(CLI) {
  /**
   * Install / Update a module
   */
  CLI.prototype.install = function(module_name, cb) {
    var that = this;

    Modularizer.install(module_name, function(err, data) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_ERR + (err.message || err));
        return cb ? cb(Common.retErr(err)) : that.speedList(cst.ERROR_EXIT);
      }

      /**
       * Check if special module with post_install display
       */
      if (data[0] && data[0].pm2_env && data[0].pm2_env.PM2_WAIT_FOR_INIT) {
        var ms = parseInt(data[0].pm2_env.PM2_WAIT_FOR_INIT);
        // Special module with post display
        UX.processing.start('Initializing module');
        setTimeout(function() {
          var pm_id = data[0].pm2_env.pm_id;

          that.describe(pm_id, function(err, data) {
            UX.processing.stop();

            var human_info  = data[0].pm2_env.axm_options.human_info
            var module_name = data[0].pm2_env.name;

            if (human_info) {
              UX.postModuleInfos(module_name, human_info);
              Common.printOut(chalk.white.italic(' Use `pm2 show %s` to display this helper'), module_name);
              Common.printOut(chalk.white.italic(' Use `pm2 logs %s [--lines 1000]` to display logs'), module_name);
              Common.printOut(chalk.white.italic(' Use `pm2 monit` to monitor CPU and Memory usage'), module_name);
              return cb ? cb(null, data) : that.exitCli(cst.SUCCESS_EXIT);
            }
            return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
          });
        }, ms);
        return false;
      }
      return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Uninstall a module
   */
  CLI.prototype.uninstall = function(module_name, cb) {
    var that = this;

    Modularizer.uninstall(module_name, function(err, data) {
      if (err)
        return cb ? cb(Common.retErr(err)) : that.speedList(cst.ERROR_EXIT);
      return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Publish module on NPM + Git push
   */
  CLI.prototype.publish = function(module_name, cb) {
    var that = this;

    Modularizer.publish(function(err, data) {
      if (err)
        return cb ? cb(Common.retErr(err)) : that.speedList(cst.ERROR_EXIT);
      return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Publish module on NPM + Git push
   */
  CLI.prototype.generateModuleSample = function(app_name, cb) {
    var that = this;

    Modularizer.generateSample(app_name, function(err, data) {
      if (err)
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, data) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  CLI.prototype.killAllModules = function(cb) {
    var that = this;

    this.Client.getAllModulesId(function(err, modules_id) {
      async.forEachLimit(modules_id, 1, function(id, next) {
        that._operate('deleteProcessId', id, next);
      }, function() {
        return cb ? cb() : false;
      });
    });
  };

  CLI.prototype.deleteModule = function(module_name, cb) {
    var that = this;

    var found_proc = [];

    this.Client.getAllProcess(function(err, procs) {
      if (err) {
        Common.printError('Error retrieving process list: ' + err);
        return cb(Common.retErr(err));
      }

      procs.forEach(function(proc) {
        if (proc.pm2_env.name == module_name && proc.pm2_env.pmx_module) {
          found_proc.push(proc.pm_id);
        }
      });

      if (found_proc.length == 0)
        return cb();

      that._operate('deleteProcessId', found_proc[0], function(err) {
        if (err) return cb(Common.retErr(err));
        Common.printOut('In memory process deleted');
        return cb();
      });
    });
  };
};
