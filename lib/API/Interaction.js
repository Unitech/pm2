
var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');
var path        = require('path');
var fs          = require('fs');
var KMDaemon    = require('../Interactor/InteractorDaemonizer');

module.exports = function(CLI) {
  /**
   * Launch interactor
   * @method interact
   * @param {string} secret_key
   * @param {string} public_key
   * @param {string} machine_name
   */
  CLI.prototype.interact = function(secret_key, public_key, machine_name, cb) {
    var that = this;

    KMDaemon.launchAndInteract(that._conf, {
      secret_key   : secret_key || null,
      public_key   : public_key || null,
      machine_name : machine_name || null
    }, function(err, dt) {
      if (err) {
        return cb ? cb(err) : that.exitCli(cst.ERROR_EXIT);
      }
      return cb ? cb(null, dt) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  CLI.prototype.interactInfos = function(cb) {
    KMDaemon.getInteractInfo(this._conf, function(err, data) {
      if (err)
        return cb(Common.retErr(err));
      return cb(null, data);
    });
  };

  //
  // Interact
  //
  CLI.prototype._pre_interact = function(secret_key, public_key, machine, opts) {
    var that = this;

    if (secret_key == 'stop' || secret_key == 'kill') {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Stopping agent...');
      that.killInteract(function() {
        console.log(chalk.cyan('[Keymetrics.io]') + ' Stopped');
        return process.exit(cst.SUCCESS_EXIT);
      });
      return false;
    }
    if (secret_key == 'info') {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Getting agent information...');
      that.interactInfos(function(err, infos) {
        if (err) {
          console.error(err.message);
          return that.exitCli(cst.ERROR_EXIT);
        }
        console.log(infos);
        return that.exitCli(cst.SUCCESS_EXIT);
      });
      return false;
    }
    if (secret_key == 'delete') {
      that.killInteract(function() {
        try {
          fs.unlinkSync(cst.INTERACTION_CONF);
        } catch(e) {
          console.log(chalk.cyan('[Keymetrics.io]') + ' No interaction config file found');
          return process.exit(cst.SUCCESS_EXIT);
        }
        console.log(chalk.cyan('[Keymetrics.io]') + ' Agent interaction ended');
        return process.exit(cst.SUCCESS_EXIT);
      });
      return false;
    }
    if (secret_key == 'start' || secret_key == 'restart')
      return that.interact(null, null, null);
    if (secret_key && !public_key) {
      console.error(chalk.cyan('[Keymetrics.io]') + ' Command [%s] unknown or missing public key', secret_key);
      return process.exit(cst.ERROR_EXIT);
    }
    return that.interact(secret_key, public_key, machine);
  };

  /**
   * Kill interactor
   * @method killInteract
   */
  CLI.prototype.killInteract = function(cb) {
    var that = this;
    KMDaemon.killInteractorDaemon(that._conf, function(err) {
      return cb ? cb(Common.retErr('Interactor not launched')) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

};
