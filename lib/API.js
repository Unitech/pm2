/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
'use strict';

const commander   = require('commander');
const fs          = require('fs');
const path        = require('path');
const eachLimit   = require('async/eachLimit');
const series      = require('async/series');
const debug       = require('debug')('pm2:cli');
const util        = require('util');
const chalk       = require('chalk');
const fclone      = require('fclone');


var conf         = require('../constants.js');
var Client      = require('./Client');
var Common      = require('./Common');
var KMDaemon    = require('@pm2/agent/src/InteractorClient');
var Config      = require('./tools/Config');
var Modularizer = require('./API/Modules/Modularizer.js');
var path_structure = require('../paths.js');
var UX          = require('./API/CliUx');
var pkg         = require('../package.json');
var flagWatch   = require("./API/Modules/flagWatch.js");
var hf = require('./API/Modules/flagExt.js');
var Configuration = require('./Configuration.js');

var IMMUTABLE_MSG = chalk.bold.blue('Use --update-env to update environment variables');

/**
 * Main Function to be imported
 * can be aliased to PM2
 *
 * To use it when PM2 is installed as a module:
 *
 * var PM2 = require('pm2');
 *
 * var pm2 = PM2(<opts>);
 *
 *
 * @param {Object}  opts
 * @param {String}  [opts.cwd=<current>]         override pm2 cwd for starting scripts
 * @param {String}  [opts.pm2_home=[<paths.js>]] pm2 directory for log, pids, socket files
 * @param {Boolean} [opts.independent=false]     unique PM2 instance (random pm2_home)
 * @param {Boolean} [opts.daemon_mode=true]      should be called in the same process or not
 * @param {String}  [opts.public_key=null]       pm2 plus bucket public key
 * @param {String}  [opts.secret_key=null]       pm2 plus bucket secret key
 * @param {String}  [opts.machine_name=null]     pm2 plus instance name
 */
class API {

  constructor (opts) {
    if (!opts) opts = {};
    var that = this;

    this.daemon_mode = typeof(opts.daemon_mode) == 'undefined' ? true : opts.daemon_mode;
    this.pm2_home = conf.PM2_ROOT_PATH;
    this.public_key = conf.PUBLIC_KEY || opts.public_key || null;
    this.secret_key = conf.SECRET_KEY || opts.secret_key || null;
    this.machine_name = conf.MACHINE_NAME || opts.machine_name || null

    /**
     * CWD resolution
     */
    this.cwd = process.cwd();
    if (opts.cwd) {
      this.cwd = path.resolve(opts.cwd);
    }

    /**
     * PM2 HOME resolution
     */
    if (opts.pm2_home && opts.independent == true)
      throw new Error('You cannot set a pm2_home and independent instance in same time');

    if (opts.pm2_home) {
      // Override default conf file
      this.pm2_home = opts.pm2_home;
      conf = util._extend(conf, path_structure(this.pm2_home));
    }
    else if (opts.independent == true && conf.IS_WINDOWS === false) {
      // Create an unique pm2 instance
      const crypto = require('crypto');
      var random_file = crypto.randomBytes(8).toString('hex');
      this.pm2_home = path.join('/tmp', random_file);

      // If we dont explicitly tell to have a daemon
      // It will go as in proc
      if (typeof(opts.daemon_mode) == 'undefined')
        this.daemon_mode = false;
      conf = util._extend(conf, path_structure(this.pm2_home));
    }

    this._conf = conf;

    if (conf.IS_WINDOWS) {
      // Weird fix, may need to be dropped
      // @todo windows connoisseur double check
      if (process.stdout._handle && process.stdout._handle.setBlocking)
        process.stdout._handle.setBlocking(true);
    }

    this.Client = new Client({
      pm2_home: that.pm2_home,
      conf: this._conf,
      secret_key: this.secret_key,
      public_key: this.public_key,
      daemon_mode: this.daemon_mode,
      machine_name: this.machine_name
    });

    this.user_conf = Configuration.getSync('pm2')

    this.gl_interact_infos = null;
    this.gl_is_km_linked = false;

    try {
      var pid = fs.readFileSync(conf.INTERACTOR_PID_PATH);
      pid = parseInt(pid.toString().trim());
      process.kill(pid, 0);
      that.gl_is_km_linked = true;
    } catch (e) {
      that.gl_is_km_linked = false;
    }

    // For testing purposes
    if (this.secret_key && process.env.NODE_ENV == 'local_test')
      that.gl_is_km_linked = true;

    KMDaemon.ping(this._conf, function(err, result) {
      if (!err && result === true) {
        fs.readFile(conf.INTERACTION_CONF, (err, _conf) => {
          if (!err) {
            try {
              that.gl_interact_infos = JSON.parse(_conf.toString())
            } catch(e) {
              var json5 = require('./tools/json5.js')
              try {
                that.gl_interact_infos = json5.parse(_conf.toString())
              } catch(e) {
                console.error(e)
                that.gl_interact_infos = null
              }
            }
          }
        })
      }
    })

    this.gl_retry = 0;
  }

  /**
   * Connect to PM2
   * Calling this command is now optional
   *
   * @param {Function} cb callback once pm2 is ready for commands
   */
  connect (noDaemon, cb) {
    var that = this;
    this.start_timer = new Date();

    if (typeof(cb) == 'undefined') {
      cb = noDaemon;
      noDaemon = false;
    } else if (noDaemon === true) {
      // Backward compatibility with PM2 1.x
      this.Client.daemon_mode = false;
      this.daemon_mode = false;
    }

    this.Client.start(function(err, meta) {
      if (err)
        return cb(err);

      if (meta.new_pm2_instance == false && that.daemon_mode === true)
        return cb(err, meta);

      // If new pm2 instance has been popped
      // Lauch all modules
      that.launchAll(that, function(err_mod) {
        return cb(err, meta);
      });
    });
  }

  /**
   * Usefull when custom PM2 created with independent flag set to true
   * This will cleanup the newly created instance
   * by removing folder, killing PM2 and so on
   *
   * @param {Function} cb callback once cleanup is successfull
   */
  destroy (cb) {
    var exec = require('shelljs').exec;
    var that = this;

    debug('Killing and deleting current deamon');

    this.killDaemon(function() {
      var cmd = 'rm -rf ' + that.pm2_home;
      var test_path = path.join(that.pm2_home, 'module_conf.json');
      var test_path_2 = path.join(that.pm2_home, 'pm2.pid');

      if (that.pm2_home.indexOf('.pm2') > -1)
        return cb(new Error('Destroy is not a allowed method on .pm2'));

      fs.access(test_path, fs.R_OK, function(err) {
        if (err) return cb(err);
        debug('Deleting temporary folder %s', that.pm2_home);
        exec(cmd, cb);
      });
    });
  }

  /**
   * Disconnect from PM2 instance
   * This will allow your software to exit by itself
   *
   * @param {Function} [cb] optional callback once connection closed
   */
  disconnect (cb) {
    var that = this;

    if (!cb) cb = function() {};

    this.Client.close(function(err, data) {
      debug('The session lasted %ds', (new Date() - that.start_timer) / 1000);
      return cb(err, data);
    });
  };

  /**
   * Alias on disconnect
   * @param cb
   */
  close (cb) {
    this.disconnect(cb);
  }

  /**
   * Launch modules
   *
   * @param {Function} cb callback once pm2 has launched modules
   */
  launchModules (cb) {
    this.launchAll(this, cb);
  }

  /**
   * Enable bus allowing to retrieve various process event
   * like logs, restarts, reloads
   *
   * @param {Function} cb callback called with 1st param err and 2nb param the bus
   */
  launchBus (cb) {
    this.Client.launchBus(cb);
  }

  /**
   * Exit methods for API
   * @param {Integer} code exit code for terminal
   */
  exitCli (code) {
    var that = this;

    // Do nothing if PM2 called programmatically (also in speedlist)
    if (conf.PM2_PROGRAMMATIC && process.env.PM2_USAGE != 'CLI') return false;

    KMDaemon.disconnectRPC(function() {
      that.Client.close(function() {
        code = code || 0;
        // Safe exits process after all streams are drained.
        // file descriptor flag.
        var fds = 0;
        // exits process when stdout (1) and sdterr(2) are both drained.
        function tryToExit() {
          if ((fds & 1) && (fds & 2)) {
            debug('This command took %ds to execute', (new Date() - that.start_timer) / 1000);
            process.exit(code);
          }
        }

        [process.stdout, process.stderr].forEach(function(std) {
          var fd = std.fd;
          if (!std.bufferSize) {
            // bufferSize equals 0 means current stream is drained.
            fds = fds | fd;
          } else {
            // Appends nothing to the std queue, but will trigger `tryToExit` event on `drain`.
            std.write && std.write('', function() {
              fds = fds | fd;
              tryToExit();
            });
          }
          // Does not write anything more.
          delete std.write;
        });
        tryToExit();
      });
    });
  }

////////////////////////////
// Application management //
////////////////////////////

  /**
   * Start a file or json with configuration
   * @param {Object||String} cmd script to start or json
   * @param {Function} cb called when application has been started
   */
  start (cmd, opts, cb) {
    if (typeof(opts) == "function") {
      cb = opts;
      opts = {};
    }
    if (!opts)
      opts = {};

    var that = this;
    if (util.isArray(opts.watch) && opts.watch.length === 0)
      opts.watch = (opts.rawArgs ? !!~opts.rawArgs.indexOf('--watch') : !!~process.argv.indexOf('--watch')) || false;

    if (Common.isConfigFile(cmd) || (typeof(cmd) === 'object'))
      that._startJson(cmd, opts, 'restartProcessId', cb);
    else {
      that._startScript(cmd, opts, cb);
    }
  }

  /**
   * Reset process counters
   *
   * @method resetMetaProcess
   */
  reset (process_name, cb) {
    var that = this;

    function processIds(ids, cb) {
      eachLimit(ids, conf.CONCURRENT_ACTIONS, function(id, next) {
        that.Client.executeRemote('resetMetaProcessId', id, function(err, res) {
          if (err) console.error(err);
          Common.printOut(conf.PREFIX_MSG + 'Resetting meta for process id %d', id);
          return next();
        });
      }, function(err) {
        if (err) return cb(Common.retErr(err));
        return cb ? cb(null, {success:true}) : that.speedList();
      });
    }

    if (process_name == 'all') {
      that.Client.getAllProcessId(function(err, ids) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        }
        return processIds(ids, cb);
      });
    }
    else if (isNaN(process_name)) {
      that.Client.getProcessIdByName(process_name, function(err, ids) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        }
        if (ids.length === 0) {
          Common.printError('Unknown process name');
          return cb ? cb(new Error('Unknown process name')) : that.exitCli(conf.ERROR_EXIT);
        }
        return processIds(ids, cb);
      });
    } else {
      processIds([process_name], cb);
    }
  }

  /**
   * Update daemonized PM2 Daemon
   *
   * @param {Function} cb callback when pm2 has been upgraded
   */
  update (cb) {
    var that = this;

    Common.printOut('Be sure to have the latest version by doing `npm install pm2@latest -g` before doing this procedure.');

    // Dump PM2 processes
    that.Client.executeRemote('notifyKillPM2', {}, function() {});

    that.getVersion(function(err, new_version) {
      // If not linked to PM2 plus, and update PM2 to latest, display motd.update
      if (!that.gl_is_km_linked && !err && (pkg.version != new_version)) {
        var dt = fs.readFileSync(path.join(__dirname, that._conf.PM2_UPDATE));
        console.log(dt.toString());
      }

      that.dump(function(err) {
        debug('Dumping successfull', err);
        that.killDaemon(function() {
          debug('------------------ Everything killed', arguments);
          that.Client.launchDaemon({interactor:false}, function(err, child) {
            that.Client.launchRPC(function() {
              that.resurrect(function() {
                Common.printOut(chalk.blue.bold('>>>>>>>>>> PM2 updated'));
                that.launchAll(that, function() {
                  KMDaemon.launchAndInteract(that._conf, null, function(err, data, interactor_proc) {
                    return cb ? cb(null, {success:true}) : that.speedList();
                  });
                });
              });
            });
          });
        });
      });
    });

    return false;
  }

  /**
   * Reload an application
   *
   * @param {String} process_name Application Name or All
   * @param {Object} opts         Options
   * @param {Function} cb         Callback
   */
  reload (process_name, opts, cb) {
    var that = this;

    if (typeof(opts) == "function") {
      cb = opts;
      opts = {};
    }

    var delay = Common.lockReload();
    if (delay > 0 && opts.force != true) {
      Common.printError(conf.PREFIX_MSG_ERR + 'Reload already in progress, please try again in ' + Math.floor((conf.RELOAD_LOCK_TIMEOUT - delay) / 1000) + ' seconds or use --force');
      return cb ? cb(new Error('Reload in progress')) : that.exitCli(conf.ERROR_EXIT);
    }

    if (Common.isConfigFile(process_name))
      that._startJson(process_name, opts, 'reloadProcessId', function(err, apps) {
        Common.unlockReload();
        if (err)
          return cb ? cb(err) : that.exitCli(conf.ERROR_EXIT);
        return cb ? cb(null, apps) : that.exitCli(conf.SUCCESS_EXIT);
      });
    else {
      if (opts && opts.env) {
        var err = 'Using --env [env] without passing the ecosystem.config.js does not work'
        Common.err(err);
        Common.unlockReload();
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }

      if (opts && !opts.updateEnv)
        Common.printOut(IMMUTABLE_MSG);

      that._operate('reloadProcessId', process_name, opts, function(err, apps) {
        Common.unlockReload();

        if (err)
          return cb ? cb(err) : that.exitCli(conf.ERROR_EXIT);
        return cb ? cb(null, apps) : that.exitCli(conf.SUCCESS_EXIT);
      });
    }
  }

  /**
   * Restart process
   *
   * @param {String} cmd   Application Name / Process id / JSON application file / 'all'
   * @param {Object} opts  Extra options to be updated
   * @param {Function} cb  Callback
   */
  restart (cmd, opts, cb) {
    if (typeof(opts) == "function") {
      cb = opts;
      opts = {};
    }
    var that = this;

    if (typeof(cmd) === 'number')
      cmd = cmd.toString();

    if (cmd == "-") {
      // Restart from PIPED JSON
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function (param) {
        process.stdin.pause();
        that.actionFromJson('restartProcessId', param, opts, 'pipe', cb);
      });
    }
    else if (Common.isConfigFile(cmd) || typeof(cmd) === 'object')
      that._startJson(cmd, opts, 'restartProcessId', cb);
    else {
      if (opts && opts.env) {
        var err = 'Using --env [env] without passing the ecosystem.config.js does not work'
        Common.err(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }
      if (opts && !opts.updateEnv)
        Common.printOut(IMMUTABLE_MSG);
      that._operate('restartProcessId', cmd, opts, cb);
    }
  }

  /**
   * Delete process
   *
   * @param {String} process_name Application Name / Process id / Application file / 'all'
   * @param {Function} cb Callback
   */
  delete (process_name, jsonVia, cb) {
    var that = this;

    if (typeof(jsonVia) === "function") {
      cb = jsonVia;
      jsonVia = null;
    }
    if (typeof(process_name) === "number") {
      process_name = process_name.toString();
    }

    if (jsonVia == 'pipe')
      return that.actionFromJson('deleteProcessId', process_name, commander, 'pipe', cb);
    if (Common.isConfigFile(process_name))
      return that.actionFromJson('deleteProcessId', process_name, commander, 'file', cb);
    else {
      that._operate('deleteProcessId', process_name, cb);
    }
  }

  /**
   * Stop process
   *
   * @param {String} process_name Application Name / Process id / Application file / 'all'
   * @param {Function} cb Callback
   */
  stop (process_name, cb) {
    var that = this;

    if (typeof(process_name) === 'number')
      process_name = process_name.toString();

    if (process_name == "-") {
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function (param) {
        process.stdin.pause();
        that.actionFromJson('stopProcessId', param, commander, 'pipe', cb);
      });
    }
    else if (Common.isConfigFile(process_name))
      that.actionFromJson('stopProcessId', process_name, commander, 'file', cb);
    else
      that._operate('stopProcessId', process_name, cb);
  }

  /**
   * Get list of all processes managed
   *
   * @param {Function} cb Callback
   */
  list (opts, cb) {
    var that = this;

    if (typeof(opts) == 'function') {
      cb = opts;
      opts = null;
    }

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }

      if (opts && opts.rawArgs && opts.rawArgs.indexOf('--watch') > -1) {
        var moment = require('moment');
        function show() {
          process.stdout.write('\\033[2J');
          process.stdout.write('\\033[0f');
          console.log('Last refresh: ', moment().format('LTS'));
          that.Client.executeRemote('getMonitorData', {}, function(err, list) {
            UX.dispAsTable(list, null);
          });
        }

        show();
        setInterval(show, 900);
        return false;
      }

      return cb ? cb(null, list) : that.speedList(null, list);
    });
  }

  /**
   * Kill Daemon
   *
   * @param {Function} cb Callback
   */
  killDaemon (cb) {
    process.env.PM2_STATUS = 'stopping'

    var that = this;

    that.Client.executeRemote('notifyKillPM2', {}, function() {});

    Common.printOut(conf.PREFIX_MSG + '[v] Modules Stopped');

    that._operate('deleteProcessId', 'all', function(err, list) {
      Common.printOut(conf.PREFIX_MSG + '[v] All Applications Stopped');
      process.env.PM2_SILENT = 'false';

      that.killAgent(function(err, data) {
        if (!err) {
          Common.printOut(conf.PREFIX_MSG + '[v] Agent Stopped');
        }

        that.Client.killDaemon(function(err, res) {
          if (err) Common.printError(err);
          Common.printOut(conf.PREFIX_MSG + '[v] PM2 Daemon Stopped');
          return cb ? cb(err, res) : that.exitCli(conf.SUCCESS_EXIT);
        });

      });
    })
  }

  kill (cb) {
    this.killDaemon(cb);
  }

  /////////////////////
  // Private methods //
  /////////////////////

  /**
   * Method to START / RESTART a script
   *
   * @private
   * @param {string} script script name (will be resolved according to location)
   */
  _startScript (script, opts, cb) {
    if (typeof opts == "function") {
      cb = opts;
      opts = {};
    }
    var that = this;

    /**
     * Commander.js tricks
     */
    var app_conf = Config.filterOptions(opts);
    var appConf = {};

    var ignoreFileArray = [];

    if (typeof app_conf.name == 'function')
      delete app_conf.name;

    delete app_conf.args;

    // Retrieve arguments via -- <args>
    var argsIndex;

    if (opts.rawArgs && (argsIndex = opts.rawArgs.indexOf('--')) >= 0)
      app_conf.args = opts.rawArgs.slice(argsIndex + 1);
    else if (opts.scriptArgs)
      app_conf.args = opts.scriptArgs;

    app_conf.script = script;

    if ((appConf = Common.verifyConfs(app_conf)) instanceof Error)
      return cb ? cb(Common.retErr(appConf)) : that.exitCli(conf.ERROR_EXIT);

    app_conf = appConf[0];

    if (opts.ignoreWatch) {
      flagWatch.handleFolders(opts.ignoreWatch, ignoreFileArray);
      if (app_conf.ignore_watch) {
        app_conf.ignore_watch = ignoreFileArray;
      }
    }

    if (opts.watchDelay) {
      if (typeof opts.watchDelay === "string" && opts.watchDelay.indexOf("ms") !== -1)
        app_conf.watch_delay = parseInt(opts.watchDelay);
      else {
        app_conf.watch_delay = parseFloat(opts.watchDelay) * 1000;
      }
    }

    var mas = [];
    if(typeof opts.ext != 'undefined')
      hf.make_available_extension(opts, mas); // for -e flag
    mas.length > 0 ? app_conf.ignore_watch = mas : 0;

    /**
     * If -w option, write configuration to configuration.json file
     */
    if (app_conf.write) {
      var dst_path = path.join(process.env.PWD || process.cwd(), app_conf.name + '-pm2.json');
      Common.printOut(conf.PREFIX_MSG + 'Writing configuration to', chalk.blue(dst_path));
      // pretty JSON
      try {
        fs.writeFileSync(dst_path, JSON.stringify(app_conf, null, 2));
      } catch (e) {
        console.error(e.stack || e);
      }
    }

    series([
      restartExistingProcessName,
      restartExistingProcessId,
      restartExistingProcessPathOrStartNew
    ], function(err, data) {
      if (err instanceof Error)
        return cb ? cb(err) : that.exitCli(conf.ERROR_EXIT);

      var ret = {};

      data.forEach(function(_dt) {
        if (_dt !== undefined)
          ret = _dt;
      });

      return cb ? cb(null, ret) : that.speedList();
    });

    /**
     * If start <app_name> start/restart application
     */
    function restartExistingProcessName(cb) {
      if (!isNaN(script) ||
        (typeof script === 'string' && script.indexOf('/') != -1) ||
        (typeof script === 'string' && path.extname(script) !== ''))
        return cb(null);

      if (script !== 'all') {
        that.Client.getProcessIdByName(script, function(err, ids) {
          if (err && cb) return cb(err);
          if (ids.length > 0) {
            that._operate('restartProcessId', script, opts, function(err, list) {
              if (err) return cb(err);
              Common.printOut(conf.PREFIX_MSG + 'Process successfully started');
              return cb(true, list);
            });
          }
          else return cb(null);
        });
      }
      else {
        that._operate('restartProcessId', 'all', function(err, list) {
          if (err) return cb(err);
          Common.printOut(conf.PREFIX_MSG + 'Process successfully started');
          return cb(true, list);
        });
      }
    }

    function restartExistingProcessId(cb) {
      if (isNaN(script)) return cb(null);

      that._operate('restartProcessId', script, opts, function(err, list) {
        if (err) return cb(err);
        Common.printOut(conf.PREFIX_MSG + 'Process successfully started');
        return cb(true, list);
      });
    }

    /**
     * Restart a process with the same full path
     * Or start it
     */
    function restartExistingProcessPathOrStartNew(cb) {
      that.Client.executeRemote('getMonitorData', {}, function(err, procs) {
        if (err) return cb ? cb(new Error(err)) : that.exitCli(conf.ERROR_EXIT);

        var full_path = path.resolve(that.cwd, script);
        var managed_script = null;

        procs.forEach(function(proc) {
          if (proc.pm2_env.pm_exec_path == full_path &&
              proc.pm2_env.name == app_conf.name)
            managed_script = proc;
        });

        if (managed_script &&
          (managed_script.pm2_env.status == conf.STOPPED_STATUS ||
            managed_script.pm2_env.status == conf.STOPPING_STATUS ||
            managed_script.pm2_env.status == conf.ERRORED_STATUS)) {
          // Restart process if stopped
          var app_name = managed_script.pm2_env.name;

          that._operate('restartProcessId', app_name, opts, function(err, list) {
            if (err) return cb ? cb(new Error(err)) : that.exitCli(conf.ERROR_EXIT);
            Common.printOut(conf.PREFIX_MSG + 'Process successfully started');
            return cb(true, list);
          });
          return false;
        }
        else if (managed_script && !opts.force) {
          Common.printError(conf.PREFIX_MSG_ERR + 'Script already launched, add -f option to force re-execution');
          return cb(new Error('Script already launched'));
        }

        var resolved_paths = null;

        try {
          resolved_paths = Common.resolveAppAttributes({
            cwd      : that.cwd,
            pm2_home : that.pm2_home
          }, app_conf);
        } catch(e) {
          Common.printError(e);
          return cb(Common.retErr(e));
        }

        Common.printOut(conf.PREFIX_MSG + 'Starting %s in %s (%d instance' + (resolved_paths.instances > 1 ? 's' : '') + ')',
          resolved_paths.pm_exec_path, resolved_paths.exec_mode, resolved_paths.instances);

        if (!resolved_paths.env) resolved_paths.env = {};

        // Set PM2 HOME in case of child process using PM2 API
        resolved_paths.env['PM2_HOME'] = that.pm2_home;

        var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
        util._extend(resolved_paths.env, additional_env);

        // Is KM linked?
        resolved_paths.km_link = that.gl_is_km_linked;

        that.Client.executeRemote('prepare', resolved_paths, function(err, data) {
          if (err) {
            Common.printError(conf.PREFIX_MSG_ERR + 'Error while launching application', err.stack || err);
            return cb(Common.retErr(err));
          }

          Common.printOut(conf.PREFIX_MSG + 'Done.');
          return cb(true, data);
        });
        return false;
      });
    }
  }

  /**
   * Method to start/restart/reload processes from a JSON file
   * It will start app not started
   * Can receive only option to skip applications
   *
   * @private
   */
  _startJson (file, opts, action, pipe, cb) {
    var config     = {};
    var appConf    = {};
    var deployConf = {};
    var apps_info  = [];
    var that = this;

    /**
     * Get File configuration
     */
    if (typeof(cb) === 'undefined' && typeof(pipe) === 'function') {
      cb = pipe;
    }
    if (typeof(file) === 'object') {
      config = file;
    } else if (pipe === 'pipe') {
      config = Common.parseConfig(file, 'pipe');
    } else {
      var data = null;

      var isAbsolute = path.isAbsolute(file)
      var file_path = isAbsolute ? file : path.join(that.cwd, file);

      debug('Resolved filepath %s', file_path);

      try {
        data = fs.readFileSync(file_path);
      } catch(e) {
        Common.printError(conf.PREFIX_MSG_ERR + 'File ' + file +' not found');
        return cb ? cb(Common.retErr(e)) : that.exitCli(conf.ERROR_EXIT);
      }

      try {
        config = Common.parseConfig(data, file);
      } catch(e) {
        Common.printError(conf.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
        console.error(e);
        return cb ? cb(Common.retErr(e)) : that.exitCli(conf.ERROR_EXIT);
      }
    }

    /**
     * Alias some optional fields
     */
    if (config.deploy)
      deployConf = config.deploy;
    if (config.apps)
      appConf = config.apps;
    else if (config.pm2)
      appConf = config.pm2;
    else
      appConf = config;
    if (!Array.isArray(appConf))
      appConf = [appConf];

    if ((appConf = Common.verifyConfs(appConf)) instanceof Error)
      return cb ? cb(appConf) : that.exitCli(conf.ERROR_EXIT);

    process.env.PM2_JSON_PROCESSING = true;

    // Get App list
    var apps_name = [];
    var proc_list = {};

    // Here we pick only the field we want from the CLI when starting a JSON
    appConf.forEach(function(app) {
      if (!app.env) { app.env = {}; }
      app.env.io = app.io;
      // --only <app>
      if (opts.only) {
        var apps = opts.only.split(/,| /)
        if (apps.indexOf(app.name) == -1)
          return false
      }
      // --watch
      if (!app.watch && opts.watch && opts.watch === true)
        app.watch = true;
      // --ignore-watch
      if (!app.ignore_watch && opts.ignore_watch)
        app.ignore_watch = opts.ignore_watch;
      if (opts.install_url)
        app.install_url = opts.install_url
      // --instances <nb>
      if (opts.instances && typeof(opts.instances) === 'number')
        app.instances = opts.instances;
      // --uid <user>
      if (opts.uid)
        app.uid = opts.uid;
      // --gid <user>
      if (opts.gid)
        app.gid = opts.gid;
      // Specific
      if (app.append_env_to_name && opts.env)
        app.name += ('-' + opts.env);
      if (opts.name_prefix && app.name.indexOf(opts.name_prefix) == -1)
        app.name = `${opts.name_prefix}:${app.name}`

      app.username = Common.getCurrentUsername();
      apps_name.push(app.name);
    });

    that.Client.executeRemote('getMonitorData', {}, function(err, raw_proc_list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }

      /**
       * Uniquify in memory process list
       */
      raw_proc_list.forEach(function(proc) {
        proc_list[proc.name] = proc;
      });

      /**
       * Auto detect application already started
       * and act on them depending on action
       */
      eachLimit(Object.keys(proc_list), conf.CONCURRENT_ACTIONS, function(proc_name, next) {
        // Skip app name (--only option)
        if (apps_name.indexOf(proc_name) == -1)
          return next();

        if (!(action == 'reloadProcessId' ||
            action == 'softReloadProcessId' ||
            action == 'restartProcessId'))
          throw new Error('Wrong action called');

        var apps = appConf.filter(function(app) {
          return app.name == proc_name;
        });

        var envs = apps.map(function(app){
          // Binds env_diff to env and returns it.
          return Common.mergeEnvironmentVariables(app, opts.env, deployConf);
        });

        // Assigns own enumerable properties of all
        // Notice: if people use the same name in different apps,
        //         duplicated envs will be overrode by the last one
        var env = envs.reduce(function(e1, e2){
          return util._extend(e1, e2);
        });

        // When we are processing JSON, allow to keep the new env by default
        env.updateEnv = true;

        // Pass `env` option
        that._operate(action, proc_name, env, function(err, ret) {
          if (err) Common.printError(err);

          // For return
          apps_info = apps_info.concat(ret);

          that.Client.notifyGod(action, proc_name);
          // And Remove from array to spy
          apps_name.splice(apps_name.indexOf(proc_name), 1);
          return next();
        });

      }, function(err) {
        if (err) return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        if (apps_name.length > 0 && action != 'start')
          Common.printOut(conf.PREFIX_MSG_WARNING + 'Applications %s not running, starting...', apps_name.join(', '));
        // Start missing apps
        return startApps(apps_name, function(err, apps) {
          apps_info = apps_info.concat(apps);
          return cb ? cb(err, apps_info) : that.speedList(err ? 1 : 0);
        });
      });
      return false;
    });

    function startApps(app_name_to_start, cb) {
      var apps_to_start = [];
      var apps_started = [];
      var apps_errored = [];

      appConf.forEach(function(app, i) {
        if (app_name_to_start.indexOf(app.name) != -1) {
          apps_to_start.push(appConf[i]);
        }
      });

      eachLimit(apps_to_start, conf.CONCURRENT_ACTIONS, function(app, next) {
        if (opts.cwd)
          app.cwd = opts.cwd;
        if (opts.force_name)
          app.name = opts.force_name;
        if (opts.started_as_module)
          app.pmx_module = true;

        var resolved_paths = null;

        // hardcode script name to use `serve` feature inside a process file
        if (app.script === 'serve') {
          app.script = path.resolve(__dirname, 'API', 'Serve.js')
        }

        try {
          resolved_paths = Common.resolveAppAttributes({
            cwd      : that.cwd,
            pm2_home : that.pm2_home
          }, app);
        } catch (e) {
          apps_errored.push(e)
          return next();
        }

        if (!resolved_paths.env) resolved_paths.env = {};

        // Set PM2 HOME in case of child process using PM2 API
        resolved_paths.env['PM2_HOME'] = that.pm2_home;

        var additional_env = Modularizer.getAdditionalConf(resolved_paths.name);
        util._extend(resolved_paths.env, additional_env);

        resolved_paths.env = Common.mergeEnvironmentVariables(resolved_paths, opts.env, deployConf);

        delete resolved_paths.env.current_conf;

        // Is KM linked?
        resolved_paths.km_link = that.gl_is_km_linked;

        if (resolved_paths.wait_ready) {
          Common.warn(`App ${resolved_paths.name} has option 'wait_ready' set, waiting for app to be ready...`)
        }

        that.Client.executeRemote('prepare', resolved_paths, function(err, data) {
          if (err) {
            Common.printError(conf.PREFIX_MSG_ERR + 'Process failed to launch %s', err.message ? err.message : err);
            return next();
          }
          if (data.length === 0) {
            Common.printError(conf.PREFIX_MSG_ERR + 'Process config loading failed', data);
            return next();
          }

          Common.printOut(conf.PREFIX_MSG + 'App [%s] launched (%d instances)', data[0].pm2_env.name, data.length);
          apps_started = apps_started.concat(data);
          next();
        });

      }, function(err) {
        var final_error = err || apps_errored.length > 0 ? apps_errored : null
        return cb ? cb(final_error, apps_started) : that.speedList();
      });
      return false;
    }
  }

  /**
   * Apply a RPC method on the json file
   * @private
   * @method actionFromJson
   * @param {string} action RPC Method
   * @param {object} options
   * @param {string|object} file file
   * @param {string} jsonVia action type (=only 'pipe' ?)
   * @param {Function}
   */
  actionFromJson (action, file, opts, jsonVia, cb) {
    var appConf = {};
    var ret_processes = [];
    var that = this;

    //accept programmatic calls
    if (typeof file == 'object') {
      cb = typeof jsonVia == 'function' ? jsonVia : cb;
      appConf = file;
    }
    else if (jsonVia == 'file') {
      var data = null;

      try {
        data = fs.readFileSync(file);
      } catch(e) {
        Common.printError(conf.PREFIX_MSG_ERR + 'File ' + file +' not found');
        return cb ? cb(Common.retErr(e)) : that.exitCli(conf.ERROR_EXIT);
      }

      try {
        appConf = Common.parseConfig(data, file);
      } catch(e) {
        Common.printError(conf.PREFIX_MSG_ERR + 'File ' + file + ' malformated');
        console.error(e);
        return cb ? cb(Common.retErr(e)) : that.exitCli(conf.ERROR_EXIT);
      }
    } else if (jsonVia == 'pipe') {
      appConf = Common.parseConfig(file, 'pipe');
    } else {
      Common.printError('Bad call to actionFromJson, jsonVia should be one of file, pipe');
      return that.exitCli(conf.ERROR_EXIT);
    }

    // Backward compatibility
    if (appConf.apps)
      appConf = appConf.apps;

    if (!Array.isArray(appConf))
      appConf = [appConf];

    if ((appConf = Common.verifyConfs(appConf)) instanceof Error)
      return cb ? cb(appConf) : that.exitCli(conf.ERROR_EXIT);

    eachLimit(appConf, conf.CONCURRENT_ACTIONS, function(proc, next1) {
      var name = '';
      var new_env;

      if (!proc.name)
        name = path.basename(proc.script);
      else
        name = proc.name;

      if (opts.only && opts.only != name)
        return process.nextTick(next1);

      if (opts && opts.env)
        new_env = Common.mergeEnvironmentVariables(proc, opts.env);
      else
        new_env = Common.mergeEnvironmentVariables(proc);

      that.Client.getProcessIdByName(name, function(err, ids) {
        if (err) {
          Common.printError(err);
          return next1();
        }
        if (!ids) return next1();

        eachLimit(ids, conf.CONCURRENT_ACTIONS, function(id, next2) {
          var opts = {};

          //stopProcessId could accept options to?
          if (action == 'restartProcessId') {
            opts = {id : id, env : new_env};
          } else {
            opts = id;
          }

          that.Client.executeRemote(action, opts, function(err, res) {
            ret_processes.push(res);
            if (err) {
              Common.printError(err);
              return next2();
            }

            if (action == 'restartProcessId') {
              that.Client.notifyGod('restart', id);
            } else if (action == 'deleteProcessId') {
              that.Client.notifyGod('delete', id);
            } else if (action == 'stopProcessId') {
              that.Client.notifyGod('stop', id);
            }

            Common.printOut(conf.PREFIX_MSG + '[%s](%d) \u2713', name, id);
            return next2();
          });
        }, function(err) {
          return next1(null, ret_processes);
        });
      });
    }, function(err) {
      if (cb) return cb(null, ret_processes);
      else return that.speedList();
    });
  }


  /**
   * Main function to operate with PM2 daemon
   *
   * @param {String} action_name  Name of action (restartProcessId, deleteProcessId, stopProcessId)
   * @param {String} process_name can be 'all', a id integer or process name
   * @param {Object} envs         object with CLI options / environment
   */
  _operate (action_name, process_name, envs, cb) {
    var that = this;
    var update_env = false;
    var ret = [];

    // Make sure all options exist
    if (!envs)
      envs = {};

    if (typeof(envs) == 'function'){
      cb = envs;
      envs = {};
    }

    // Set via env.update (JSON processing)
    if (envs.updateEnv === true)
      update_env = true;

    var concurrent_actions = envs.parallel || conf.CONCURRENT_ACTIONS;

    if (!process.env.PM2_JSON_PROCESSING || envs.commands) {
      envs = that._handleAttributeUpdate(envs);
    }

    /**
     * Set current updated configuration if not passed
     */
    if (!envs.current_conf) {
      var _conf = fclone(envs);
      envs = {
        current_conf : _conf
      }

      // Is KM linked?
      envs.current_conf.km_link = that.gl_is_km_linked;
    }

    /**
     * Operate action on specific process id
     */
    function processIds(ids, cb) {
      Common.printOut(conf.PREFIX_MSG + 'Applying action %s on app [%s](ids: %s)', action_name, process_name, ids);

      if (ids.length <= 2)
        concurrent_actions = 1;

      if (action_name == 'deleteProcessId')
        concurrent_actions = 10;

      eachLimit(ids, concurrent_actions, function(id, next) {
        var opts;

        // These functions need extra param to be passed
        if (action_name == 'restartProcessId' ||
          action_name == 'reloadProcessId' ||
          action_name == 'softReloadProcessId') {
          var new_env = {};

          if (update_env === true) {
            if (conf.PM2_PROGRAMMATIC == true)
              new_env = Common.safeExtend({}, process.env);
            else
              new_env = util._extend({}, process.env);

            Object.keys(envs).forEach(function(k) {
              new_env[k] = envs[k];
            });
          }
          else {
            new_env = envs;
          }

          opts = {
            id  : id,
            env : new_env
          };
        }
        else {
          opts = id;
        }

        that.Client.executeRemote(action_name, opts, function(err, res) {
          if (err) {
            Common.printError(conf.PREFIX_MSG_ERR + 'Process %s not found', id);
            return next('Process not found');
          }

          if (action_name == 'restartProcessId') {
            that.Client.notifyGod('restart', id);
          } else if (action_name == 'deleteProcessId') {
            that.Client.notifyGod('delete', id);
          } else if (action_name == 'stopProcessId') {
            that.Client.notifyGod('stop', id);
          } else if (action_name == 'reloadProcessId') {
            that.Client.notifyGod('reload', id);
          } else if (action_name == 'softReloadProcessId') {
            that.Client.notifyGod('graceful reload', id);
          }

          if (!Array.isArray(res))
            res = [res];

          // Filter return
          res.forEach(function(proc) {
            Common.printOut(conf.PREFIX_MSG + '[%s](%d) \u2713', proc.pm2_env ? proc.pm2_env.name : process_name, id);

            if (!proc.pm2_env) return false;

            ret.push({
              name         : proc.pm2_env.name,
              pm_id        : proc.pm2_env.pm_id,
              status       : proc.pm2_env.status,
              restart_time : proc.pm2_env.restart_time,
              pm2_env : {
                name         : proc.pm2_env.name,
                pm_id        : proc.pm2_env.pm_id,
                status       : proc.pm2_env.status,
                restart_time : proc.pm2_env.restart_time,
                env          : proc.pm2_env.env
              }
            });
          });

          return next();
        });
      }, function(err) {
        if (err) return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        return cb ? cb(null, ret) : that.speedList();
      });
    }

    if (process_name == 'all') {
      // When using shortcuts like 'all', do not delete modules
      var fn

      if (process.env.PM2_STATUS == 'stopping')
        that.Client.getAllProcessId(function(err, ids) {
          reoperate(err, ids)
        });
      else
        that.Client.getAllProcessIdWithoutModules(function(err, ids) {
          reoperate(err, ids)
        });

      function reoperate(err, ids) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        }
        if (!ids || ids.length === 0) {
          Common.printError(conf.PREFIX_MSG_WARNING + 'No process found');
          return cb ? cb(new Error('process name not found')) : that.exitCli(conf.ERROR_EXIT);
        }
        return processIds(ids, cb);
      }
    }
    // operate using regex
    else if (isNaN(process_name) && process_name[0] === '/' && process_name[process_name.length - 1] === '/') {
      var regex = new RegExp(process_name.replace(/\//g, ''));

      that.Client.executeRemote('getMonitorData', {}, function(err, list) {
        if (err) {
          Common.printError('Error retrieving process list: ' + err);
          return cb(err);
        }
        var found_proc = [];
        list.forEach(function(proc) {
          if (regex.test(proc.pm2_env.name)) {
            found_proc.push(proc.pm_id);
          }
        });

        if (found_proc.length === 0) {
          Common.printError(conf.PREFIX_MSG_WARNING + 'No process found');
          return cb ? cb(new Error('process name not found')) : that.exitCli(conf.ERROR_EXIT);
        }

        return processIds(found_proc, cb);
      });
    }
    else if (isNaN(process_name)) {
      /**
       * We can not stop or delete a module but we can restart it
       * to refresh configuration variable
       */
      var allow_module_restart = action_name == 'restartProcessId' ? true : false;

      that.Client.getProcessIdByName(process_name, allow_module_restart, function(err, ids) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
        }
        if (!ids || ids.length === 0) {
          Common.printError(conf.PREFIX_MSG_ERR + 'Process %s not found', process_name);
          return cb ? cb(new Error('process name not found')) : that.exitCli(conf.ERROR_EXIT);
        }

        /**
         * Determine if the process to restart is a module
         * if yes load configuration variables and merge with the current environment
         */
        var additional_env = Modularizer.getAdditionalConf(process_name);
        util._extend(envs, additional_env);

        return processIds(ids, cb);
      });
    } else {
      // Check if application name as number is an app name
      that.Client.getProcessIdByName(process_name, function(err, ids) {
        if (ids.length > 0)
          return processIds(ids, cb);
        // Else operate on pm id
        return processIds([process_name], cb);
      });
    }
  }

  /**
   * Converts CamelCase Commander.js arguments
   * to Underscore
   * (nodeArgs -> node_args)
   */
  _handleAttributeUpdate (opts) {
    var conf = Config.filterOptions(opts);
    var that = this;

    if (typeof(conf.name) != 'string')
      delete conf.name;

    var argsIndex = 0;
    if (opts.rawArgs && (argsIndex = opts.rawArgs.indexOf('--')) >= 0) {
      conf.args = opts.rawArgs.slice(argsIndex + 1);
    }

    var appConf = Common.verifyConfs(conf)[0];

    if (appConf instanceof Error) {
      Common.printError('Error while transforming CamelCase args to underscore');
      return appConf;
    }

    if (argsIndex == -1)
      delete appConf.args;
    if (appConf.name == 'undefined')
      delete appConf.name;

    delete appConf.exec_mode;

    if (util.isArray(appConf.watch) && appConf.watch.length === 0) {
      if (!~opts.rawArgs.indexOf('--watch'))
        delete appConf.watch
    }

    // Options set via environment variables
    if (process.env.PM2_DEEP_MONITORING)
      appConf.deep_monitoring = true;

    // Force deletion of defaults values set by commander
    // to avoid overriding specified configuration by user
    if (appConf.treekill === true)
      delete appConf.treekill;
    if (appConf.pmx === true)
      delete appConf.pmx;
    if (appConf.vizion === true)
      delete appConf.vizion;
    if (appConf.automation === true)
      delete appConf.automation;
    if (appConf.autorestart === true)
      delete appConf.autorestart;

    return appConf;
  }

  getProcessIdByName (name, cb) {
    var that = this;

    this.Client.getProcessIdByName(name, function(err, id) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }
      console.log(id);
      return cb ? cb(null, id) : that.exitCli(conf.SUCCESS_EXIT);
    });
  }

  /**
   * Description
   * @method jlist
   * @param {} debug
   * @return
   */
  jlist (debug) {
    var that = this;

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError(err);
        that.exitCli(conf.ERROR_EXIT);
      }

      if (debug) {
        process.stdout.write(util.inspect(list, false, null, false));
      }
      else {
        process.stdout.write(JSON.stringify(list));
      }

      that.exitCli(conf.SUCCESS_EXIT);

    });
  }

  /**
   * Description
   * @method speedList
   * @return
   */
  speedList (code, list) {
    var that = this;

    // Do nothing if PM2 called programmatically and not called from CLI (also in exitCli)
    if (conf.PM2_PROGRAMMATIC && process.env.PM2_USAGE != 'CLI') return false;

    if (list) {
      return doList(null, list)
    }

    that.Client.executeRemote('getMonitorData', {}, doList);

    function doList(err, list) {
      if (err) {
        if (that.gl_retry == 0) {
          that.gl_retry += 1;
          return setTimeout(that.speedList.bind(that), 1400);
        }
        console.error('Error retrieving process list: %s.\nA process seems to be on infinite loop, retry in 5 seconds',err);
        return that.exitCli(conf.ERROR_EXIT);
      }
      if (process.stdout.isTTY === false) {
        UX.miniDisplay(list);
      }
      else if (commander.miniList && !commander.silent)
        UX.miniDisplay(list);
      else if (!commander.silent) {
        if (that.gl_interact_infos) {
          Common.printOut('%s  PM2+ activated | Web: %s | Server: %s | Conn: %s',
                          chalk.green.bold('⇆'),
                          chalk.bold('https://app.pm2.io/#/r/' + that.gl_interact_infos.public_key),
                          chalk.bold(that.gl_interact_infos.machine_name),
                          that.gl_interact_infos.agent_transport_websocket === 'true' ? 'Websocket' : 'Axon');
          if (that.gl_interact_infos.info_node != 'https://root.keymetrics.io') {
            Common.printOut(`PM2+ on-premise link: ${that.gl_interact_infos.info_node}`)
          }
        }
        UX.dispAsTable(list, commander);
        Common.printOut(chalk.white.italic(' Use `pm2 show <id|name>` to get more details about an app'));
      }

      if (that.Client.daemon_mode == false) {
        Common.printOut('[--no-daemon] Continue to stream logs');
        Common.printOut('[--no-daemon] Exit on target PM2 exit pid=' + fs.readFileSync(conf.PM2_PID_FILE_PATH).toString());
        global._auto_exit = true;
        return that.streamLogs('all', 0, false, 'HH:mm:ss', false);
      }
      else if (commander.attach === true) {
        return that.streamLogs('all', 0, false, null, false);
      }
      else {
        return that.exitCli(code ? code : conf.SUCCESS_EXIT);
      }
    }
  }

  /**
   * Scale up/down a process
   * @method scale
   */
  scale (app_name, number, cb) {
    var that = this;

    function addProcs(proc, value, cb) {
      (function ex(proc, number) {
        if (number-- === 0) return cb();
        Common.printOut(conf.PREFIX_MSG + 'Scaling up application');
        that.Client.executeRemote('duplicateProcessId', proc.pm2_env.pm_id, ex.bind(this, proc, number));
      })(proc, number);
    }

    function rmProcs(procs, value, cb) {
      var i = 0;

      (function ex(procs, number) {
        if (number++ === 0) return cb();
        that._operate('deleteProcessId', procs[i++].pm2_env.pm_id, ex.bind(this, procs, number));
      })(procs, number);
    }

    function end() {
      return cb ? cb(null, {success:true}) : that.speedList();
    }

    this.Client.getProcessByName(app_name, function(err, procs) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(conf.ERROR_EXIT);
      }

      if (!procs || procs.length === 0) {
        Common.printError(conf.PREFIX_MSG_ERR + 'Application %s not found', app_name);
        return cb ? cb(new Error('App not found')) : that.exitCli(conf.ERROR_EXIT);
      }

      var proc_number = procs.length;

      if (typeof(number) === 'string' && number.indexOf('+') >= 0) {
        number = parseInt(number, 10);
        return addProcs(procs[0], number, end);
      }
      else if (typeof(number) === 'string' && number.indexOf('-') >= 0) {
        number = parseInt(number, 10);
        return rmProcs(procs[0], number, end);
      }
      else {
        number = parseInt(number, 10);
        number = number - proc_number;

        if (number < 0)
          return rmProcs(procs, number, end);
        else if (number > 0)
          return addProcs(procs[0], number, end);
        else {
          Common.printError(conf.PREFIX_MSG_ERR + 'Nothing to do');
          return cb ? cb(new Error('Same process number')) : that.exitCli(conf.ERROR_EXIT);
        }
      }
    });
  }

  /**
   * Description
   * @method describeProcess
   * @param {} pm2_id
   * @return
   */
  describe (pm2_id, cb) {
    var that = this;

    var found_proc = [];

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError('Error retrieving process list: ' + err);
        that.exitCli(conf.ERROR_EXIT);
      }

      list.forEach(function(proc) {
        if ((!isNaN(pm2_id)    && proc.pm_id == pm2_id) ||
          (typeof(pm2_id) === 'string' && proc.name  == pm2_id)) {
          found_proc.push(proc);
        }
      });

      if (found_proc.length === 0) {
        Common.printError(conf.PREFIX_MSG_WARNING + '%s doesn\'t exist', pm2_id);
        return cb ? cb(null, []) : that.exitCli(conf.ERROR_EXIT);
      }

      if (!cb) {
        found_proc.forEach(function(proc) {
          UX.describeTable(proc);
        });
      }

      return cb ? cb(null, found_proc) : that.exitCli(conf.SUCCESS_EXIT);
    });
  }

  /**
   * API method to perform a deep update of PM2
   * @method deepUpdate
   */
  deepUpdate (cb) {
    var that = this;

    Common.printOut(conf.PREFIX_MSG + 'Updating PM2...');

    var exec = require('shelljs').exec;
    var child = exec("npm i -g pm2@latest; pm2 update", {async : true});

    child.stdout.on('end', function() {
      Common.printOut(conf.PREFIX_MSG + 'PM2 successfully updated');
      cb ? cb(null, {success:true}) : that.exitCli(conf.SUCCESS_EXIT);
    });
  }
};


//////////////////////////
// Load all API methods //
//////////////////////////

require('./API/Extra.js')(API);
require('./API/Deploy.js')(API);
require('./API/Modules/index.js')(API);

require('./API/pm2-plus/link.js')(API);
require('./API/pm2-plus/process-selector.js')(API);
require('./API/pm2-plus/helpers.js')(API);

require('./API/Configuration.js')(API);
require('./API/Version.js')(API);
require('./API/Startup.js')(API);
require('./API/LogManagement.js')(API);
require('./API/Containerizer.js')(API);


module.exports = API;
