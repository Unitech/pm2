
var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');
var path        = require('path');
var fs          = require('fs');
var KMDaemon    = require('@pm2/agent/src/InteractorClient');
var pkg         = require('../../package.json')

module.exports = function(CLI) {

  var installServerMonit = function(CLI, cb) {
    if (process.env.NO_SERVER_MONIT ||
        process.env.NODE_ENV == 'test' ||
        cst.IS_WINDOWS == true)
      return cb();

    CLI.Client.executeRemote('getMonitorData', {}, function(err, list) {
      var installed = list.some(function(app) {
        return app.name == 'pm2-server-monit';
      });
      if (installed == false)
        CLI.install('pm2-server-monit', cb);
      else cb();
    })
  };

  /**
   * Launch interactor
   * For programmatic interaction
   * http://pm2.keymetrics.io/docs/usage/use-pm2-with-cloud-providers/
   * @method interact
   * @param {string} secret_key
   * @param {string} public_key
   * @param {string} machine_name
   */
  CLI.prototype.interact = function(secret_key, public_key, machine_name, cb) {
    var that = this;

    if (typeof(machine_name) == 'function') {
      cb = machine_name;
      machine_name = null;
    }
    KMDaemon.launchAndInteract(that._conf, {
      secret_key   : secret_key || null,
      public_key   : public_key || null,
      machine_name : machine_name || null,
      pm2_version: pkg.version
    }, function(err, dt) {
      if (err) {
        return cb ? cb(err) : that.exitCli(cst.ERROR_EXIT);
      }
      return cb ? cb(null, dt) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Aliases
   */
  CLI.prototype.link = CLI.prototype.interact;

  CLI.prototype.unlink = function(cb) {
    this._pre_interact('delete', cb);
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
  CLI.prototype._pre_interact = function(cmd, public_key, machine, opts) {
    var that = this;

    if (cmd == 'stop' || cmd == 'kill') {
      console.log(chalk.cyan('[PM2 agent]') + ' Stopping agent...');
      that.killInteract(function() {
        console.log(chalk.cyan('[PM2 agent]') + ' Stopped');
        return process.exit(cst.SUCCESS_EXIT);
      });
      return false;
    }

    if (cmd == 'info') {
      console.log(chalk.cyan('[PM2 agent]') + ' Getting agent information...');
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

    if (cmd == 'delete') {
      that.killInteract(function() {
        try {
          fs.unlinkSync(cst.INTERACTION_CONF);
        } catch(e) {
          console.log(chalk.cyan('[PM2 agent]') + ' No interaction config file found');
          return process.exit(cst.SUCCESS_EXIT);
        }
        console.log(chalk.cyan('[PM2 agent]') + ' Agent interaction ended');
        return process.exit(cst.SUCCESS_EXIT);
      });
      return false;
    }

    if (cmd == 'start' || cmd == 'restart') {
      KMDaemon.launchAndInteract(that._conf, {
        public_key : null,
        secret_key : null,
        machine_name : null,
        info_node : null,
        pm2_version: pkg.version
      }, function(err, dt) {
        if (err) {
          Common.printError(err);
          return that.exitCli(cst.ERROR_EXIT);
        }
        return that.exitCli(cst.SUCCESS_EXIT);
      });
    }

    if (cmd && !public_key) {
      console.error(chalk.cyan('[PM2 agent]') + ' Command [%s] unknown or missing public key', cmd);
      return process.exit(cst.ERROR_EXIT);
    }

    var infos;

    if (!cmd) {
      infos = null;
    }
    else
      infos = {
        public_key : public_key,
        secret_key : cmd,
        machine_name : machine,
        info_node : opts.infoNode || null,
        pm2_version: pkg.version
      }

    if (opts.ws === true && infos) {
      infos.agent_transport_axon = false
      infos.agent_transport_websocket = true
      process.env.AGENT_TRANSPORT_AXON = false
      process.env.AGENT_TRANSPORT_WEBSOCKET = true
    }
    else if (infos) {
      infos.agent_transport_axon = true
      infos.agent_transport_websocket = false
      process.env.AGENT_TRANSPORT_AXON = true
      process.env.AGENT_TRANSPORT_WEBSOCKET = false
    }

    KMDaemon.launchAndInteract(that._conf, infos, function(err, dt) {
      if (err)
        return that.exitCli(cst.ERROR_EXIT);
      return that.exitCli(cst.SUCCESS_EXIT);
    });
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
