
/***************************
 *
 * Module methods
 *
 **************************/

var cst          = require('../../../constants.js');
var Common       = require('../../Common.js');
var UX           = require('../CliUx');
var chalk        = require('chalk');
var forEachLimit = require('async/forEachLimit');

var Modularizer = require('./Modularizer.js');

module.exports = function(CLI) {
  /**
   * Install / Update a module
   */
  CLI.prototype.install = function(module_name, opts, cb) {
    var that = this;

    if (typeof(opts) == 'function') {
      cb = opts;
      opts = {};
    }

    Modularizer.install(this, module_name, opts, function(err, data) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_ERR + (err.message || err));
        return cb ? cb(Common.retErr(err)) : that.speedList(cst.ERROR_EXIT);
      }
      return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Uninstall a module
   */
  CLI.prototype.uninstall = function(module_name, cb) {
    var that = this;

    Modularizer.uninstall(this, module_name, function(err, data) {
      if (err)
        return cb ? cb(Common.retErr(err)) : that.speedList(cst.ERROR_EXIT);
      return cb ? cb(null, data) : that.speedList(cst.SUCCESS_EXIT);
    });
  };

  CLI.prototype.launchAll = function(CLI, cb) {
    Modularizer.launchModules(CLI, cb);
  };

  CLI.prototype.package = function(module_path, cb) {
    Modularizer.package(this, module_path, (err, res) => {
      if (err) {
        Common.errMod(err)
        return cb ? cb(err) : this.exitCli(1)
      }
      Common.logMod(`Module packaged in ${res.path}`)
      return cb ? cb(err) : this.exitCli(0)
    })
  };

  /**
   * Publish module on NPM + Git push
   */
  CLI.prototype.publish = function(folder, opts, cb) {
    var that = this;

    Modularizer.publish(this, folder, opts, function(err, data) {
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

  /**
   * Special delete method
   */
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

// Special module with post display
function postDisplay(app, cb) {
  var that = this;
  var retry = 0;

  UX.processing.start('Initializing module');

  (function detectModuleInit() {
    retry++;
    if (retry > 12) {
      // Module init has timeouted
      return displayOrNot(null);
    }
    that.describe(app.pm_id, function(err, data) {

      if (data && data[0] && data[0].pm2_env &&
          data[0].pm2_env.axm_options &&
          data[0].pm2_env.axm_options.human_info) {
        return displayOrNot(data[0]);
      }
      setTimeout(function() {
        detectModuleInit();
      }, 300);
    });
  })();

  function displayOrNot(app) {
    UX.processing.stop();

    if (app) {
      var module_name = app.name;
      var human_info = app.pm2_env.axm_options.human_info;

      UX.postModuleInfos(module_name, human_info);
      Common.printOut(chalk.white.italic(' Use `pm2 show %s` to display this helper'), module_name);
      Common.printOut(chalk.white.italic(' Use `pm2 logs %s [--lines 1000]` to display logs'), module_name);
      Common.printOut(chalk.white.italic(' Use `pm2 monit` to monitor CPU and Memory usage'), module_name);
      return cb ? cb(null, app) : that.exitCli(cst.SUCCESS_EXIT);
    }

    return cb ? cb(null, { msg : 'Module started' }) : that.speedList(cst.SUCCESS_EXIT);
  }
}
