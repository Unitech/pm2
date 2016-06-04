
/***************************
 *
 * Extra methods
 *
 **************************/

var cst         = require('../../constants.js');
var Common      = require('../Common.js');
var Modularizer = require('../Modularizer.js');
var UX          = require('./CliUx');
var chalk       = require('chalk');
var async       = require('async');
var path        = require('path');
var Satan       = require('../Satan');
var fs          = require('fs');

module.exports = function(CLI) {

  /**
   * Get version of the daemonized PM2
   * @method getVersion
   * @callback cb
   */
  CLI.getVersion = function(cb) {
    Satan.executeRemote('getVersion', {}, function(err) {
      return cb ? cb.apply(null, arguments) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Description
   * @method sendSignalToProcessName
   * @param {} signal
   * @param {} process_name
   * @return
   */
  CLI.sendDataToProcessId = function(proc_id, packet, cb) {
    packet.id = proc_id;

    Satan.executeRemote('sendDataToProcessId', packet, function(err, res) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent data to process');
      return cb ? cb(null, res) : CLI.speedList();
    });
  };

  /**
   * Description
   * @method sendSignalToProcessName
   * @param {} signal
   * @param {} process_name
   * @return
   */
  CLI.sendSignalToProcessName = function(signal, process_name, cb) {
    Satan.executeRemote('sendSignalToProcessName', {
      signal : signal,
      process_name : process_name
    }, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent signal %s to process name %s', signal, process_name);
      return cb ? cb(null, list) : CLI.speedList();
    });
  };

  /**
   * Description
   * @method sendSignalToProcessId
   * @param {} signal
   * @param {} process_id
   * @return
   */
  CLI.sendSignalToProcessId = function(signal, process_id, cb) {
    Satan.executeRemote('sendSignalToProcessId', {
      signal : signal,
      process_id : process_id
    }, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('successfully sent signal %s to process id %s', signal, process_id);
      return cb ? cb(null, list) : CLI.speedList();
    });
  };

  /**
   * Launch API interface
   * @method web
   * @return
   */
  CLI.web = function(cb) {
    var filepath = path.resolve(path.dirname(module.filename), '../HttpInterface.js');

    CLI.start(filepath, {
      name : 'pm2-http-interface',
      execMode : 'fork_mode'
    }, function(err, proc) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
        return cb ? cb(Common.retErr(err)) : CLI.speedList();
      }
      Common.printOut(cst.PREFIX_MSG + 'Process launched');
      return cb ? cb(null, proc) : CLI.speedList();
    });
  };


  /**
   * Ping daemon - if PM2 daemon not launched, it will launch it
   * @method ping
   */
  CLI.ping = function(cb) {
    Satan.executeRemote('ping', {}, function(err, res) {
      if (err) {
        Common.printError(err);
        return cb ? cb(new Error(err)) : Common.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut(res);
      return cb ? cb(null, res) : Common.exitCli(cst.SUCCESS_EXIT);
    });
  };


  /**
   * Execute remote command
   */
  CLI.remote = function(command, opts, cb) {
    CLI[command](opts.name, function(err_cmd, ret) {
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
  CLI.remoteV2 = function(command, opts, cb) {
    if (CLI[command].length == 1)
      return CLI[command](cb);

    opts.args.push(cb);
    return CLI[command].apply(this, opts.args);
  };


  /**
   * Description
   * @method generateSample
   * @param {} name
   * @return
   */
  CLI.generateSample = function() {
    var templatePath = path.join(cst.TEMPLATE_FOLDER, cst.APP_CONF_TPL);

    var sample = fs.readFileSync(templatePath);
    var dt     = sample.toString();
    var f_name = 'ecosystem.json';

    try {
      fs.writeFileSync(path.join(process.env.PWD, f_name), dt);
    } catch (e) {
      console.error(e.stack || e);
    }
    Common.printOut('File %s generated', path.join(process.env.PWD, f_name));
    Common.exitCli(cst.SUCCESS_EXIT);
  };
};
