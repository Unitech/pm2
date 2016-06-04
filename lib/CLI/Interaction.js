

var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var Modularizer = require('../Modularizer.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');
var path        = require('path');
var fs          = require('fs');
var KMDaemon    = require('../Interactor/InteractorDaemonizer');

module.exports = function(CLI) {

  //
  // Interact
  //
  CLI._pre_interact = function(secret_key, public_key, machine, opts) {
    var recycle = opts.recycle || false;

    if (secret_key == 'stop' || secret_key == 'kill') {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Stopping agent...');
      CLI.killInteract(function() {
        console.log(chalk.cyan('[Keymetrics.io]') + ' Stopped');
        return process.exit(cst.SUCCESS_EXIT);
      });
      return false;
    }
    if (secret_key == 'info') {
      console.log(chalk.cyan('[Keymetrics.io]') + ' Getting agent information...');
      KMDaemon.getInteractInfo(function(err, data) {
        if (err) {
          Common.printError('Interactor not launched');
          return Common.exitCli(cst.ERROR_EXIT);
        }
        Common.printOut(data);
        return Common.exitCli(cst.SUCCESS_EXIT);
      });
      return false;
    }
    if (secret_key == 'delete') {
      CLI.killInteract(function() {
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
      return CLI.interact(null, null, null);
    if (secret_key && !public_key) {
      console.error(chalk.cyan('[Keymetrics.io]') + ' Command [%s] unknown or missing public key', secret_key);
      return process.exit(cst.ERROR_EXIT);
    }
    return CLI.interact(secret_key, public_key, machine, recycle);
  };

  /**
   * Launch interactor
   * @method interact
   * @param {string} secret_key
   * @param {string} public_key
   * @param {string} machine_name
   */
  CLI.interact = function(secret_key, public_key, machine_name, recycle, cb) {
    if (typeof(recycle) === 'function') {
      cb = recycle;
      recycle = null;
    }
    if (typeof(recycle) !== 'boolean') {
      recycle = false;
    }

    KMDaemon.launchAndInteract({
      secret_key   : secret_key || null,
      public_key   : public_key || null,
      machine_name : machine_name || null,
      recycle      : recycle || null
    }, function(err, dt) {
      if (err)
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      return cb ? cb(null, dt) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Kill interactor
   * @method killInteract
   */
  CLI.killInteract = function(cb) {
    KMDaemon.killDaemon(function(err) {
      return cb ? cb(Common.retErr('Interactor not launched')) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  };

};
