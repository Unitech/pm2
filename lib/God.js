'use strict';

/**
 * Module dependencies
 */

var cluster       = require('cluster');
var numCPUs       = require('os').cpus() ? require('os').cpus().length : 1;
var path          = require('path');
var util          = require('util');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var fs            = require('fs');
var p             = path;
var Common        = require('./Common');
var cst           = require('../constants.js');

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
    newListener: false,
    maxListeners: 20
  })
};

/**
 * Populate God namespace
 */
require('./God/Methods.js')(God);
require('./God/ForkMode.js')(God);
require('./God/ClusterMode.js')(God);
require('./God/Reload')(God);
require('./God/ActionMethods')(God);

/**
 * Forced entry to initialize cluster monitoring
 */

(function initEngine() {
  cluster.on('online', function(clu) {
    console.log('%s - id%d worker online', clu.pm2_env.pm_exec_path, clu.pm2_env.pm_id);
    clu.pm2_env.status = cst.ONLINE_STATUS;
    God.bus.emit('process:online', { process : clu });
  });

  cluster.on('exit', function(clu, code, signal) {
    handleExit(clu, code);
  });
})();

/**
 * Handle logic when a process exit (Node or Fork)
 * @method handleExit
 * @param {} clu
 * @param {} exit_code
 * @return
 */
function handleExit(clu, exit_code) {
  console.log('Script %s %s exited code %d', clu.pm2_env.pm_exec_path, clu.pm2_env.pm_id, exit_code);

  var stopping    = (clu.pm2_env.status == cst.STOPPING_STATUS || clu.pm2_env.status == cst.ERRORED_STATUS) ? true : false;
  var overlimit   = false;
  var pidFile     = [clu.pm2_env.pm_pid_path, clu.pm2_env.pm_id, '.pid'].join('');

  if (stopping)  clu.process.pid = 0;

  if (clu.pm2_env.axm_actions) clu.pm2_env.axm_actions = [];

  if (clu.pm2_env.status != cst.ERRORED_STATUS &&
      clu.pm2_env.status != cst.STOPPING_STATUS)
    clu.pm2_env.status = cst.STOPPED_STATUS;

  try {
    fs.unlinkSync(pidFile);
  } catch(e) { console.error('Error when unlinking PID file', e); }

  /**
   * Avoid infinite reloop if an error is present
   */
  // If the process has been created less than 15seconds ago

  // And if the process has an uptime less than a second
  var min_uptime = (clu.pm2_env.min_uptime || 1000);
  var max_restarts = (clu.pm2_env.max_restarts || 15);

  if ((Date.now() - clu.pm2_env.created_at) < (min_uptime * max_restarts)) {
    if ((Date.now() - clu.pm2_env.pm_uptime) < min_uptime) {
      // Increment unstable restart
      clu.pm2_env.unstable_restarts += 1;
    }

    if (clu.pm2_env.unstable_restarts >= max_restarts) {
      // Too many unstable restart in less than 15 seconds
      // Set the process as 'ERRORED'
      // And stop to restart it
      clu.pm2_env.status = cst.ERRORED_STATUS;
      console.log('Script %s had too many unstable restarts (%d). Stopped.',
                  clu.pm2_env.pm_exec_path,
                  clu.pm2_env.unstable_restarts);
      God.bus.emit('process:exit:overlimit', { process : clu });
      clu.pm2_env.unstable_restarts = 0;
      clu.pm2_env.created_at = null;
      overlimit = true;
    }
  }

  God.bus.emit('process:exit', { process : clu });

  if (!stopping)
    clu.pm2_env.restart_time = clu.pm2_env.restart_time + 1;

  if (!stopping && !overlimit) God.executeApp(clu.pm2_env);
}


/**
 * Launch the specified script (present in env)
 * @api private
 * @method executeApp
 * @param {Mixed} env
 * @param {Function} cb
 * @return Literal
 */
God.executeApp = function(env, cb) {
  var env_copy = JSON.parse(JSON.stringify(env));

  util._extend(env_copy, env.env);

  env_copy['axm_actions'] = [];

  if (env_copy['pm_id'] === undefined) {
    /**
     * Enter here when it's the first time that the process is created
     * 1 - Assign a new id
     * 2 - Reset restart time and unstable_restarts
     * 3 - Assign a log file name depending on the id
     * 4 - If watch option is set, look for changes
     */
    env_copy['pm_id']             = God.getNewId();
    env_copy['restart_time']      = 0;
    env_copy['unstable_restarts'] = 0;

    // If merge option, dont separate the logs
    if (!env_copy['merge_logs']) {
      env_copy.pm_out_log_path = env_copy.pm_out_log_path.replace(/-[0-9]+\.log$|\.log$/g, '-' + env_copy['pm_id'] + '.log');
      env_copy.pm_err_log_path = env_copy.pm_err_log_path.replace(/-[0-9]+\.log$|\.log$/g, '-' + env_copy['pm_id'] + '.log');
    }

    if (env_copy['watch']) {
        env_copy['watcher'] = require('./Watcher').watch(env_copy);
    }
  }

  if (!env_copy.created_at)
    env_copy['created_at']        = Date.now();

  env_copy['pm_uptime']  = Date.now();
  env_copy['status']     = cst.LAUNCHING_STATUS;

  if (env_copy['exec_mode'] == 'fork_mode') {
    /**
     * Fork mode logic
     */
    God.forkMode(env_copy, function(err, clu) {
      if (cb && err) return cb(err);

      God.clusters_db[env_copy.pm_id] = clu;

      clu.once('error', function(err) {
        clu.pm2_env.status = cst.ERRORED_STATUS;
      });

      clu.once('close', function(code) {
        handleExit(clu, code);
      });

      God.bus.emit('process:online', {process : clu });
      if (cb) cb(null, clu);

      return false;
    });
  }
  else {
    /**
     * Cluster mode logic (for NodeJS apps)
     */
    God.nodeApp(env_copy, function(err, clu) {
      if (cb && err) return cb(err);
      if (err) return false;
      God.clusters_db[clu.pm2_env.pm_id] = clu;
      if (cb) cb(null, clu);
      return false;
    });
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
God.prepare = function(env, cb) {
  // If instances option is set (-i [arg])
  if (env.instances) {
    if (env.instances == 'max') env.instances = numCPUs;
    env.instances = parseInt(env.instances);
    // multi fork depending on number of cpus
    var arr = [];

    (function ex(i) {
      if (i <= 0) {
        if (cb != null) return cb(null, arr);
        return false;
      }
      return God.executeApp(JSON.parse(JSON.stringify(env)), function(err, clu) { // deep copy
        if (err) return ex(i - 1);
        arr.push(clu);
        return ex(i - 1);
      });
    })(env.instances);
  }
  else {
    return God.executeApp(env, function(err, dt) {
      cb(err, [dt]);
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
God.prepareJson = function (app, cwd, cb) {
  if (!cb) {
    cb = cwd;
    cwd = undefined;
  }

  app = Common.resolveAppPaths(app, cwd);
  if (app instanceof Error)
    return cb(app);

  return God.prepare(app, cb);
};
