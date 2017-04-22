
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
   * @param {String} [uuid]       optional unique identifier when logs are emitted
   *
   */
  CLI.prototype.msgProcess = function(opts, cb) {
    var that = this;

    that.Client.executeRemote('msgProcess', opts, cb);
  };

  /**
   * Trigger a PMX custom action in target application
   * Custom actions allows to interact with an application
   *
   * @method trigger
   * @param  {String|Number} pm_id       process id or application name
   * @param  {String}        action_name name of the custom action to trigger
   * @param  {Mixed}         params      parameter to pass to target action
   * @param  {Function}      cb          callback
   */
  CLI.prototype.trigger = function(pm_id, action_name, params, cb) {
    if (typeof(params) === 'function') {
      cb = params;
      params = null;
    }
    var cmd = {
      msg : action_name
    };
    var counter = 0;
    var process_wait_count = 0;
    var that = this;
    var results = [];

    if (params)
      cmd.opts = params;
    if (isNaN(pm_id))
      cmd.name = pm_id;
    else
      cmd.id = pm_id;

    this.launchBus(function(err, bus) {
      bus.on('axm:reply', function(ret) {
        if (ret.process.name == pm_id || ret.process.pm_id == pm_id) {
          results.push(ret);
          Common.printOut('[%s:%s]=%j', ret.process.name, ret.process.pm_id, ret.data.return);
          if (++counter == process_wait_count)
            return cb ? cb(null, results) : that.exitCli(cst.SUCCESS_EXIT);
        }
      });

      that.msgProcess(cmd, function(err, data) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        }
        process_wait_count = data.process_count;
        Common.printOut(chalk.bold('%s processes have received command %s'),
                        data.process_count, action_name);
      });
    });
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
   * API method to launch a process that will serve directory over http
   *
   * @param {Object} opts options
   * @param {String} opts.path path to be served
   * @param {Number} opts.port port on which http will bind
   * @param {Function} cb optional callback
   */
  CLI.prototype.serve = function (target_path, port, opts, cb) {
    var that = this;
    var servePort = process.env.PM2_SERVE_PORT || port || 8080;
    var servePath = path.resolve(process.env.PM2_SERVE_PATH || target_path || '.');

    var filepath = path.resolve(path.dirname(module.filename), './Serve.js');

    if (!opts.name || typeof(opts.name) == 'function')
      opts.name = 'static-page-server-' + servePort;
    if (!opts.env)
      opts.env = {};
    opts.env.PM2_SERVE_PORT = servePort;
    opts.env.PM2_SERVE_PATH = servePath;
    opts.cwd = servePath;

    this.start(filepath, opts,  function (err, res) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Error while trying to serve : ' + err.message || err);
        return cb ? cb(err) : that.speedList(cst.ERROR_EXIT);
      }
      Common.printOut(cst.PREFIX_MSG + 'Serving ' + servePath + ' on port ' + servePort);
      return cb ? cb(null, res) : that.speedList();
    });
  }

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
  CLI.prototype.generateSample = function(mode) {
    var that = this;
    var templatePath;

    if (mode == 'simple')
      templatePath = path.join(cst.TEMPLATE_FOLDER, cst.APP_CONF_TPL_SIMPLE);
    else
      templatePath = path.join(cst.TEMPLATE_FOLDER, cst.APP_CONF_TPL);

    var sample = fs.readFileSync(templatePath);
    var dt     = sample.toString();
    var f_name = 'ecosystem.config.js';
		var pwd = process.env.PWD || process.cwd();

    try {
      fs.writeFileSync(path.join(pwd, f_name), dt);
    } catch (e) {
      console.error(e.stack || e);
      return that.exitCli(cst.ERROR_EXIT);
    }
    Common.printOut('File %s generated', path.join(pwd, f_name));
    that.exitCli(cst.SUCCESS_EXIT);
  };

  /**
   * Description
   * @method dashboard
   * @return
   */
  CLI.prototype.dashboard = function(cb) {
    var that = this;

    var Dashboard = require('./Dashboard');

    if (cb) return cb(new Error('Dashboard cant be called programmatically'));

    Dashboard.init();

    this.Client.launchBus(function (err, bus) {
      if (err) {
          console.error('Error launchBus: ' + err);
          that.exitCli(cst.ERROR_EXIT);
      }
      bus.on('log:*', function(type, data) {
        Dashboard.log(type, data);
      })
    });

    process.on('SIGINT', function() {
      this.Client.disconnectBus(function() {
        process.exit(cst.SUCCESS_EXIT);
      });
    });

    function launchDashboard() {
      that.Client.executeRemote('getMonitorData', {}, function(err, list) {
        if (err) {
          console.error('Error retrieving process list: ' + err);
          that.exitCli(cst.ERROR_EXIT);
        }

        Dashboard.refresh(list);

        setTimeout(function() {
          launchDashboard();
        }, 800);
      });
    }

    launchDashboard();
  };

  CLI.prototype.monit = function(cb) {
    var that = this;

    var Monit = require('./Monit.js');

    if (cb) return cb(new Error('Monit cant be called programmatically'));

    Monit.init();

    function launchMonitor() {
      that.Client.executeRemote('getMonitorData', {}, function(err, list) {
        if (err) {
          console.error('Error retrieving process list: ' + err);
          that.exitCli(conf.ERROR_EXIT);
        }

        Monit.refresh(list);

        setTimeout(function() {
          launchMonitor();
        }, 400);
      });
    }

    launchMonitor();
  };
};
