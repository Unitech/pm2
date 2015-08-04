
var cluster       = require('cluster');
var numCPUs       = require('os').cpus() ? require('os').cpus().length : 1;
var path          = require('path');
var util          = require('util');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var fs            = require('fs');
var p             = path;
var Common        = require('./Common');
var cst           = require('../constants.js');
var pidusage      = require('pidusage');
var vizion        = require('vizion');
var debug         = require('debug')('pm2:god');
var Utility       = require('./Utility.js');

/**
 * Override cluster module configuration
 */
cluster.setupMaster({
  exec : p.resolve(p.dirname(module.filename), 'ProcessContainer.js')
});

/**
 * Expose God
 */
var God = module.exports = {
  next_id : 0,
  clusters_db : {},
  bus : new EventEmitter2({
    wildcard: true,
    delimiter: ':',
    maxListeners: 1000
  })
};

Utility.overrideConsole(God.bus);

/**
 * Populate God namespace
 */
require('./Event.js')(God);
require('./God/LockSystem.js')(God);
require('./God/Methods.js')(God);
require('./God/ForkMode.js')(God);
require('./God/ClusterMode.js')(God);
require('./God/Reload')(God);
require('./God/ActionMethods')(God);
require('./God/DeprecatedCalls')(God);
require('./Watcher')(God);

/**
 * Launch the specified script (present in env)
 * @api private
 * @method executeApp
 * @param {Mixed} env
 * @param {Function} cb
 * @return Literal
 */
God.executeApp = function executeApp(env, cb) {
  var env_copy = Common.clone(env);
  var startingInside = (env_copy['env'] && env_copy['env']['pm_id'] && !env_copy['started_inside']) ? true : false;

  Common.extend(env_copy, env_copy.env);

  env_copy['status']         = cst.LAUNCHING_STATUS;
  env_copy['pm_uptime']      = Date.now();
  env_copy['axm_actions']    = [];
  env_copy['axm_monitor']    = {};
  env_copy['axm_options']    = {};
  env_copy['axm_dynamic']    = {};
  env_copy['vizion_running'] =
    env_copy['vizion_running'] !== undefined ? env_copy['vizion_running'] : false;

  if (!env_copy.created_at)
    env_copy['created_at'] = Date.now();

  /**
   * Enter here when it's the first time that the process is created
   * 1 - Assign a new id
   * 2 - Reset restart time and unstable_restarts
   * 3 - Assign a log file name depending on the id
   * 4 - If watch option is set, look for changes
   */
  if (env_copy['pm_id'] === undefined || startingInside) {
    env_copy['pm_id']             = God.getNewId();
    env_copy['restart_time']      = 0;
    env_copy['unstable_restarts'] = 0;
    env_copy['started_inside']    = startingInside;

    env_copy['command']     = {
      locked      : false,
      metadata    : {},
      started_at  : null,
      finished_at : null,
      error       : null
    };

    // add -pm_id to pid file
    env_copy.pm_pid_path = env_copy.pm_pid_path.replace(/-[0-9]+\.pid$|\.pid$/g, '-' + env_copy['pm_id'] + '.pid');

    // If merge option, dont separate the logs
    if (!env_copy['merge_logs']) {
      ['', '_out', '_err'].forEach(function(k){
        var key = 'pm' + k + '_log_path';
        env_copy[key] && (env_copy[key] = env_copy[key].replace(/-[0-9]+\.log$|\.log$/g, '-' + env_copy['pm_id'] + '.log'));
      });
    }

    // Initiate watch file
    if (env_copy['watch']) {
      God.watch.enable(env_copy);
    }
  }

  //if (env_copy['command']) env_copy['command'].locked = false;

  /**
   * Avoid `Resource leak error` due to 'disconnect' event
   * not being fired sometimes
   */
  var workAround = function(worker) {
    var listeners = null;

    listeners = worker.process.listeners('exit')[0];
    var exit = listeners[Object.keys(listeners)[0]];

    listeners = worker.process.listeners('disconnect')[0];
    var disconnect = listeners[Object.keys(listeners)[0]];

    worker.process.removeListener('exit', exit);
    worker.process.once('exit', function(exitCode, signalCode) {
      // If disconnect() has not been called
      // earlier, we call it here.
      if (worker.state != 'disconnected')
        disconnect();
      // Call the original 'exit' callback
      exit(exitCode, signalCode);
    });
  };

  if (env_copy.exec_mode === 'cluster_mode') {
    /**
     * Cluster mode logic (for NodeJS apps)
     */
    God.nodeApp(env_copy, function nodeApp(err, clu) {
      if (cb && err) return cb(err);
      if (err) return false;

      var old_env = God.clusters_db[clu.pm2_env.pm_id];

      if (old_env) {
        old_env = null;
        God.clusters_db[clu.pm2_env.pm_id] = null;
      }

      God.clusters_db[clu.pm2_env.pm_id] = clu;

      // Temporary
      workAround(clu);

      clu.once('error', function(err) {
        console.error(err.stack || err);
        clu.pm2_env.status = cst.ERRORED_STATUS;
        try {
          clu.destroy && clu.destroy();
        }
        catch (e) {
          console.error(e.stack || e);
          God.handleExit(clu, cst.ERROR_EXIT);
        }
      });

      clu.once('disconnect', function() {
        console.log('App name:%s id:%s disconnected', clu.pm2_env.name, clu.pm2_env.pm_id);
      });

      clu.once('exit', function cluExit(code, signal) {
        God.handleExit(clu, signal || code);
      });

      clu.once('online', function cluOnline() {
        console.log('App name:%s id:%s online', clu.pm2_env.name, clu.pm2_env.pm_id);
        clu.pm2_env.status = cst.ONLINE_STATUS;
        if (clu.pm2_env.vizion !== false)
          God.finalizeProcedure(clu)
        else
          God.notify('online', clu);
        if (cb) cb(null, clu);
      });
      return false;
    });
  }
  else {
    /**
     * Fork mode logic
     */
    God.forkMode(env_copy, function forkMode(err, clu) {
      if (cb && err) return cb(err);
      if (err) return false;

      var old_env = God.clusters_db[clu.pm2_env.pm_id];
      if (old_env) old_env = null;

      var proc = God.clusters_db[env_copy.pm_id] = clu;

      clu.once('error', function cluError(err) {
        console.error(err.stack || err);
        proc.pm2_env.status = cst.ERRORED_STATUS;
        try {
          clu.kill && clu.kill();
        }
        catch (e) {
          console.error(e.stack || e);
          God.handleExit(clu, cst.ERROR_EXIT);
        }
      });

      clu.once('exit', function cluClose(code, signal) {
        if (clu.connected === true)
          clu.disconnect && clu.disconnect();
        clu._reloadLogs = null;
        return God.handleExit(proc, signal || code);
      });

      if (proc.pm2_env.vizion !== false)
        God.finalizeProcedure(proc)
      else
        God.notify('online', proc);

      console.log('App name:%s id:%s online', proc.pm2_env.name, proc.pm2_env.pm_id);
      if (cb) cb(null, clu);
      return false;
    });
  }
  return false;
};

/**
 * Handle logic when a process exit (Node or Fork)
 * @method handleExit
 * @param {} clu
 * @param {} exit_code
 * @return
 */
God.handleExit = function handleExit(clu, exit_code) {
  console.log('App name:%s id:%s exited with code %s', clu.pm2_env.name, clu.pm2_env.pm_id, exit_code);

  var proc = this.clusters_db[clu.pm2_env.pm_id];

  if (!proc) {
    console.error('Process undefined ? with process id ', clu.pm2_env.pm_id);
    return false;
  }

  if (proc.process.pid)
    pidusage.unmonitor(proc.process.pid);

  var stopping    = (proc.pm2_env.status == cst.STOPPING_STATUS
                     || proc.pm2_env.status == cst.STOPPED_STATUS
                     || proc.pm2_env.status == cst.ERRORED_STATUS) || proc.pm2_env.autorestart === false;

  var overlimit   = false;

  if (stopping) proc.process.pid = 0;

  // Reset probes and actions
  if (proc.pm2_env.axm_actions) proc.pm2_env.axm_actions = [];
  if (proc.pm2_env.axm_monitor) proc.pm2_env.axm_monitor = {};

  if (proc.pm2_env.status != cst.ERRORED_STATUS &&
      proc.pm2_env.status != cst.STOPPING_STATUS)
    proc.pm2_env.status = cst.STOPPED_STATUS;

  if (proc.pm2_env.pm_id.toString().indexOf('_old_') !== 0) {
    try {
      fs.unlinkSync(proc.pm2_env.pm_pid_path);
    } catch (e) {}
  }

  /**
   * Avoid infinite reloop if an error is present
   */
  // If the process has been created less than 15seconds ago

  // And if the process has an uptime less than a second
  var min_uptime = typeof(proc.pm2_env.min_uptime) !== 'undefined' ? proc.pm2_env.min_uptime : 1000;
  var max_restarts = typeof(proc.pm2_env.max_restarts) !== 'undefined' ? proc.pm2_env.max_restarts : 15;

  if ((Date.now() - proc.pm2_env.created_at) < (min_uptime * max_restarts)) {
    if ((Date.now() - proc.pm2_env.pm_uptime) < min_uptime) {
      // Increment unstable restart
      proc.pm2_env.unstable_restarts += 1;
    }

    if (proc.pm2_env.unstable_restarts >= max_restarts) {
      // Too many unstable restart in less than 15 seconds
      // Set the process as 'ERRORED'
      // And stop restarting it
      proc.pm2_env.status = cst.ERRORED_STATUS;
      proc.process.pid = 0;

      console.log('Script %s had too many unstable restarts (%d). Stopped. %j',
                  proc.pm2_env.pm_exec_path,
                  proc.pm2_env.unstable_restarts,
                  proc.pm2_env.status);

      God.notify('restart overlimit', proc);

      proc.pm2_env.unstable_restarts = 0;
      proc.pm2_env.created_at = null;
      overlimit = true;
    }
  }

  if (typeof(exit_code) !== 'undefined') proc.pm2_env.exit_code = exit_code;

  God.notify('exit', proc);

  if (God.pm2_being_killed) {
    console.log('[HandleExit] PM2 is being killed, stopping restart procedure...');
    return false;
  }

  var restart_delay = 0;
  if (proc.pm2_env.restart_delay !== undefined && !isNaN(parseInt(proc.pm2_env.restart_delay))) {
    restart_delay = parseInt(proc.pm2_env.restart_delay);
  }

  if (!stopping && !overlimit) {
    setTimeout(function() {
      proc.pm2_env.restart_time += 1;
      God.executeApp(proc.pm2_env);
    }, restart_delay);
  }

  return false;
};

/**
 * First step before execution
 * Check if the -i parameter has been passed
 * so we execute the app multiple time
 * @api public
 * @method prepare
 * @param {Mixed} env
 * @param {} cb
 * @return Literal
 */
God.prepare = function prepare(env, cb) {
  // If instances option is set (-i [arg])
  if (typeof env.instances != 'undefined') {
    if (env.instances == 0) env.instances = numCPUs;
    env.instances = parseInt(env.instances);
    if (env.instances < 0) env.instances += numCPUs;
    if (env.instances <= 0) env.instances = 1;
    // multi fork depending on number of cpus
    var arr = [];
    var instance_id = 0;

    (function ex(i) {
      if (i <= 0) {
        if (cb) return cb(null, arr);
        return false;
      }

      env.NODE_APP_INSTANCE = instance_id++;
      return God.executeApp(Common.clone(env), function(err, clu) {
        if (err) return ex(i - 1);
        arr.push(Common.clone(clu));
        God.notify('start', clu, true);
        return ex(i - 1);
      });
    })(env.instances);
  }
  else {
    return God.executeApp(env, function(err, clu) {
      God.notify('start', clu, true);
      cb(err, [Common.clone(clu)]);
    });
  }
  return false;
};

/**
 * Allows an app to be prepared using the same json format as the CLI, instead
 * of the internal PM2 format.
 * An array of applications is not currently supported. Call this method
 * multiple times with individual app objects if you have several to start.
 * @method prepareJson
 * @param app {Object}
 * @param {} cwd
 * @param cb {Function}
 * @return CallExpression
 */
God.prepareJson = function prepareJson(app, cwd, cb) {
  if (!cb) {
    cb = cwd;
    cwd = undefined;
  }

  app = Common.prepareAppConf(app, cwd);

  if (app instanceof Error)
    return cb(app);

  return God.prepare(app, cb);
};

/**
 * @method finalizeProcedure
 * @param proc {Object}
 * @return
 */
God.finalizeProcedure = function finalizeProcedure(proc) {
  var last_path    = '';
  var current_path = path.dirname(proc.pm2_env.pm_exec_path);
  var proc_id      = proc.pm2_env.pm_id;

  if (proc.pm2_env.vizion_running === true) {
    debug('Vizion is already running for proc id: %d, skipping this round', proc_id);
    return God.notify('online', proc);
  }

  proc.pm2_env.vizion_running = true;

  vizion.analyze({folder : current_path}, function recur_path(err, meta){
    var proc = God.clusters_db[proc_id];

    if (!proc ||
        !proc.pm2_env ||
        proc.pm2_env.status == cst.STOPPED_STATUS ||
        proc.pm2_env.status == cst.STOPPING_STATUS) {
      return console.error('Proc is not defined anymore or is being killed');
    }

    proc.pm2_env.vizion_running = false;

    if (!err) {
      proc.pm2_env.versioning = meta;
      proc.pm2_env.versioning.repo_path = current_path;
      God.notify('online', proc);
    }
    else if (err && current_path === last_path) {
      proc.pm2_env.versioning = null;
      God.notify('online', proc);
    }
    else {
      last_path = current_path;
      current_path = path.dirname(current_path);
      proc.pm2_env.vizion_running = true;
      vizion.analyze({folder : current_path}, recur_path);
    }
    return false;
  });
};

require('./Worker.js')(God);
God.Worker.start();
