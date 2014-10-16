
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
var vizionar      = require('vizionar');

// require('webkit-devtools-agent').start({
//   port: 9999,
//   bind_to: '0.0.0.0',
//   ipc_port: 3333,
//   verbose: true
// });

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
    wildcard: false,
    delimiter: ':',
    maxListeners: 1000
  })
};

process.on('uncaughtException', function(err) {
  if (err && err.message == 'Resource leak detected.') {
    console.error(err.stack);
    console.error('Resource leak detected for cluster module');
  }
  else if (err) {
    console.error(err.stack);

    if (God.dumpProcessList)
      God.dumpProcessList(function() {
        return process.exit(cst.ERROR_EXIT);
      });
    else
      return process.exit(cst.ERROR_EXIT);
  }
});

/**
 * Populate God namespace
 */
require('./Event.js')(God);
require('./God/Methods.js')(God);
require('./God/ForkMode.js')(God);
require('./God/ClusterMode.js')(God);
require('./God/Reload')(God);
require('./God/ActionMethods')(God);
require('./God/DeprecatedCalls')(God);
require('./Watcher')(God);


/**
 * Handle logic when a process exit (Node or Fork)
 * @method handleExit
 * @param {} clu
 * @param {} exit_code
 * @return
 */
God.handleExit = function handleExit(clu, exit_code) {
  console.log('App name:%s id:%s exited', clu.pm2_env.name, clu.pm2_env.pm_id);

  var proc = this.clusters_db[clu.pm2_env.pm_id];

  if (!proc) {
    console.error('Process undefined ? with process id ', clu.pm2_env.pm_id);
    return false;
  }

  pidusage.unmonitor(proc.process.pid);

  var stopping    = (proc.pm2_env.status == cst.STOPPING_STATUS || proc.pm2_env.status == cst.ERRORED_STATUS) ? true : false;
  var overlimit   = false;

  if (stopping)  proc.process.pid = 0;

  if (proc.pm2_env.axm_actions) proc.pm2_env.axm_actions = [];

  if (proc.pm2_env.status != cst.ERRORED_STATUS &&
      proc.pm2_env.status != cst.STOPPING_STATUS)
    proc.pm2_env.status = cst.STOPPED_STATUS;

  try {
    fs.unlinkSync(proc.pm2_env.pm_pid_path);
  } catch (e) {}

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
      // And stop to restart it
      proc.pm2_env.status = cst.ERRORED_STATUS;

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

  God.notify('exit', proc);

  if (!stopping)
    proc.pm2_env.restart_time = proc.pm2_env.restart_time + 1;

  if (!stopping && !overlimit)
    this.executeApp(proc.pm2_env);

  return false;
};


/**
 * Launch the specified script (present in env)
 * @api private
 * @method executeApp
 * @param {Mixed} env
 * @param {Function} cb
 * @return Literal
 */
God.executeApp = function executeApp(env, cb) {
  // Check if this is and old temporary process
  if (env['pm_id'] != undefined &&
      typeof(env['pm_id']) == 'string' &&
      env['pm_id'].indexOf('_old_') != -1) {
    console.error('Tried to restart dead process', env['pm_id']);
    if (cb) cb({msg:'Tried to restart dead process'});
    return false;
  }

  var env_copy = Common.serialize(env);

  util._extend(env_copy, env_copy.env);

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

    // add -pm_id to pid file
    env_copy.pm_pid_path = env_copy.pm_pid_path.replace(/-[0-9]+\.pid$|\.pid$/g, '-' + env_copy['pm_id'] + '.pid');

    // If merge option, dont separate the logs
    if (!env_copy['merge_logs']) {
      env_copy.pm_out_log_path = env_copy.pm_out_log_path.replace(/-[0-9]+\.log$|\.log$/g, '-' + env_copy['pm_id'] + '.log');
      env_copy.pm_err_log_path = env_copy.pm_err_log_path.replace(/-[0-9]+\.log$|\.log$/g, '-' + env_copy['pm_id'] + '.log');
    }

    if (env_copy['watch']) {
      env_copy['watcher'] = God.watch.enable(env_copy);
    }
  }

  if (!env_copy.created_at)
    env_copy['created_at'] = Date.now();

  env_copy['pm_uptime']  = Date.now();
  env_copy['status']     = cst.LAUNCHING_STATUS;

  if (env_copy['exec_mode'] == 'fork_mode' ||
      env_copy['exec_mode'] == 'fork') {
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
        return God.handleExit(proc);
      });

      clu.once('close', function cluClose(code) {
        proc.removeAllListeners();
        clu._reloadLogs = null;
        return God.handleExit(proc, code);
      });

      God.finalizeProcedure(proc);

      console.log('App name:%s id:%s online', proc.pm2_env.name, proc.pm2_env.pm_id);
      if (cb) cb(null, clu);
      return false;
    });
  }
  else {
    /**
     * Cluster mode logic (for NodeJS apps)
     */
    God.nodeApp(env_copy, function nodeApp(err, clu) {
      if (cb && err) return cb(err);
      if (err) return false;

      var old_env = God.clusters_db[clu.pm2_env.pm_id];

      if (old_env) {
        old_env = null;

        if (typeof(God.clusters_db[clu.pm2_env.pm_id].process._handle) !== 'undefined') {
          if (God.clusters_db[clu.pm2_env.pm_id].process._handle)
            God.clusters_db[clu.pm2_env.pm_id].process._handle.owner = null;
          God.clusters_db[clu.pm2_env.pm_id].process._handle = null;
          God.clusters_db[clu.pm2_env.pm_id].process = null;
        }
        God.clusters_db[clu.pm2_env.pm_id] = null;
      }

      var proc = God.clusters_db[clu.pm2_env.pm_id] = clu;

      clu.once('online', function cluOnline() {
        proc.pm2_env.status = cst.ONLINE_STATUS;

        console.log('App name:%s id:%s online', proc.pm2_env.name, proc.pm2_env.pm_id);

        God.finalizeProcedure(proc);

        if (cb) return cb(null, proc);
        return false;
      });

      clu.once('exit', function cluExit(exited_clu, code) {
        proc.removeAllListeners();
        proc.process.removeAllListeners();
        God.handleExit(proc, code);
        return false;
      });

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
God.prepare = function prepare(env, cb) {
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

      return God.executeApp(Common.serialize(env), function(err, clu) {
        if (err) return ex(i - 1);
        arr.push(clu);
        God.notify('start', clu, true);
        return ex(i - 1);
      });
    })(env.instances);
  }
  else {
    return God.executeApp(env, function(err, dt) {
      cb(err, [Common.serialize(dt)]);
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

  app = Common.resolveAppPaths(app, cwd);

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
  var current_path = path.dirname(proc.pm2_env.pm_exec_path);
  var proc_id      = proc.pm2_env.pm_id;

  God.notify('online', proc);
  vizionar({folder : current_path}, function recur_path(err, meta){
    current_path = path.dirname(current_path);

    var proc = God.clusters_db[proc_id];

    if (!proc ||
       proc.pm2_env.status == cst.STOPPED_STATUS ||
       proc.pm2_env.status == cst.STOPPING_STATUS) {
      return console.error('Proc is not defined anymore or is being killed');
    }

    if (!err) {
      proc.pm2_env.versioning = meta;
    }
    else if (err && current_path == '/') {
      proc.pm2_env.versioning = null;
    }
    else {
      vizionar({folder : current_path}, recur_path);
    }
    return false;
  });
};
