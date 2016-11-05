
/***************************
 *
 * Extra methods
 *
 **************************/

var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');
var path        = require('path');
var fs          = require('fs');

module.exports = function(CLI) {

  /**
   * Get version of the daemonized PM2
   * @method getVersion
   * @callback cb
   */
  CLI.prototype.getVersion = function(cb) {
    var that = this;

    that.Client.executeRemote('getVersion', {}, function(err) {
      return cb ? cb.apply(null, arguments) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };


  /**
   * Create PM2 memory snapshot
   * @method getVersion
   * @callback cb
   */
  CLI.prototype.snapshotPM2 = function(cb) {
    var that = this;
    var moment = require('moment');
    var file = path.join(process.cwd(), moment().format('dd-HH:mm:ss') + '.heapsnapshot');

    that.Client.executeRemote('snapshotPM2', {
      pwd : file
    }, function(err) {
      if (err) {
        console.error(err);
        return that.exitCli(1);
      }
      console.log('Heapdump in %s', file);
      return cb ? cb.apply(null, arguments) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };


  /**
   * Create PM2 memory snapshot
   * @method getVersion
   * @callback cb
   */
  CLI.prototype.profilePM2 = function(command, cb) {
    var that = this;
    var moment = require('moment');
    var file = path.join(process.cwd(), moment().format('dd-HH:mm:ss') + '.cpuprofile');

    if (command == 'start') {
      that.Client.executeRemote('profileStart', {
      }, function(err) {
        if (err) {
          console.error(err);
          return that.exitCli(1);
        }
        console.log('CPU profiling started, type pm2 profile stop once finished');
        return cb ? cb.apply(null, arguments) : that.exitCli(cst.SUCCESS_EXIT);
      });
    }
    else if (command == 'stop') {
      that.Client.executeRemote('profileStop', {
        pwd : file
      }, function(err) {
        if (err) {
          console.error(err);
          return that.exitCli(1);
        }
        console.log('CPU profile in %s', file);
        return cb ? cb.apply(null, arguments) : that.exitCli(cst.SUCCESS_EXIT);
      });
    }
  };

  /**
   * Description
   * @method sendDataToProcessId
   */
  CLI.prototype.sendDataToProcessId = function(proc_id, packet, cb) {
    var that = this;

    packet.id = proc_id;

    that.Client.executeRemote('sendDataToProcessId', packet, function(err, res) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent data to process');
      return cb ? cb(null, res) : that.speedList();
    });
  };

  /**
   * Used for custom actions, allows to trigger function inside an app
   * To expose a function you need to use keymetrics/pmx
   *
   * @method msgProcess
   * @param {Object} opts
   * @param {String} id           process id
   * @param {String} action_name  function name to trigger
   * @param {Object} [opts.opts]  object passed as first arg of the function
   * @param {String} [uuid]       optionnal unique identifier when logs are emitted
   *
   * @todo allow to trigger custom function from CLI
   */
  CLI.prototype.msgProcess = function(opts, cb) {
    var that = this;

    that.Client.executeRemote('msgProcess', opts, cb);
  };

  /**
   * Description
   * @method sendSignalToProcessName
   * @param {} signal
   * @param {} process_name
   * @return
   */
  CLI.prototype.sendSignalToProcessName = function(signal, process_name, cb) {
    var that = this;

    that.Client.executeRemote('sendSignalToProcessName', {
      signal : signal,
      process_name : process_name
    }, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent signal %s to process name %s', signal, process_name);
      return cb ? cb(null, list) : that.speedList();
    });
  };

  /**
   * Description
   * @method sendSignalToProcessId
   * @param {} signal
   * @param {} process_id
   * @return
   */
  CLI.prototype.sendSignalToProcessId = function(signal, process_id, cb) {
    var that = this;

    that.Client.executeRemote('sendSignalToProcessId', {
      signal : signal,
      process_id : process_id
    }, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent signal %s to process id %s', signal, process_id);
      return cb ? cb(null, list) : that.speedList();
    });
  };

  /**
   * Launch API interface
   * @method web
   * @return
   */
  CLI.prototype.web = function(port, cb) {
    var that = this;

    if (typeof(port) === 'function') {
      cb = port;
      port = 9615;
    }

    var filepath = path.resolve(path.dirname(module.filename), '../HttpInterface.js');

    that.start({
      script : filepath,
      name : 'pm2-http-interface',
      execMode : 'fork_mode',
      env : {
        PM2_WEB_PORT : port
      }
    }, function(err, proc) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
        return cb ? cb(Common.retErr(err)) : that.speedList();
      }
      Common.printOut(cst.PREFIX_MSG + 'Process launched');
      return cb ? cb(null, proc) : that.speedList();
    });
  };


  /**
   * Ping daemon - if PM2 daemon not launched, it will launch it
   * @method ping
   */
  CLI.prototype.ping = function(cb) {
    var that = this;

    that.Client.executeRemote('ping', {}, function(err, res) {
      if (err) {
        Common.printError(err);
        return cb ? cb(new Error(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut(res);
      return cb ? cb(null, res) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };


  /**
   * Execute remote command
   */
  CLI.prototype.remote = function(command, opts, cb) {
    var that = this;

    that[command](opts.name, function(err_cmd, ret) {
      if (err_cmd)
        console.error(err_cmd);
      console.log('Command %s finished', command);
      return cb(err_cmd, ret);
    });
  };

  /**
   * This remote method allows to pass multiple arguments
   * to PM2
   * It is used for the new scoped PM2 action system
   */
  CLI.prototype.remoteV2 = function(command, opts, cb) {
    var that = this;

    if (that[command].length == 1)
      return that[command](cb);

    opts.args.push(cb);
    return that[command].apply(this, opts.args);
  };


  /**
   * Description
   * @method generateSample
   * @param {} name
   * @return
   */
  CLI.prototype.generateSample = function() {
    var that = this;

    var templatePath = path.join(cst.TEMPLATE_FOLDER, cst.APP_CONF_TPL);

    var sample = fs.readFileSync(templatePath);
    var dt     = sample.toString();
    var f_name = 'ecosystem.config.js';
		var pwd = process.env.PWD || process.cwd();

    try {
      fs.writeFileSync(path.join(pwd, f_name), dt);
    } catch (e) {
      console.error(e.stack || e);
    }
    Common.printOut('File %s generated', path.join(pwd, f_name));
    that.exitCli(cst.SUCCESS_EXIT);
  };
};
