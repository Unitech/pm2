
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
// var observe       = require('observe-js');

// Memory leak inspector
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

///////////////////////////////////////////////////////
// Temporary disabling this because tests don't pass //
///////////////////////////////////////////////////////

// var obs = new observe.ObjectObserver(God.clusters_db);
// obs.open(function() {
//   God.dumpProcessList && God.dumpProcessList(function() {
//     console.log('Process List Dumped');
//   });
// });
// if (!Object.observe) {
//   setInterval(Platform.performMicrotaskCheckpoint, 1000);
// }

/**
 * Hack Global Console Of PM2
 */
(function hackConsole(){
  if (cst.PM2_LOG_DATE_FORMAT && typeof cst.PM2_LOG_DATE_FORMAT == 'string'){
    var moment = require('moment');

    // Generate timestamp prefix
    function timestamp(){
      return moment().format(cst.PM2_LOG_DATE_FORMAT) + ': ';
    }

    var hacks = ['info', 'log', 'error', 'warn'], consoled = {};

    // store console functions.
    hacks.forEach(function(method){
      consoled[method] = console[method];
    });

    // Hack Console.
    hacks.forEach(function(k){
      console[k] = function(){
        // do not destroy variable insertion
        arguments[0] && (arguments[0] = timestamp() + arguments[0]);
        consoled[k].apply(console, arguments);
      };
    });
  }
})();

// process.on('uncaughtException', function(err) {
//   if (err && err.message == 'Resource leak detected.') {
//     // Catch and ignore this error
//     // Throw by cluster module with Node 0.11.13<=
//     console.error(err.stack);
//     console.error('Resource leak detected for cluster module');
//   }
//   else if (err) {
//     console.error(err.stack);

//     if (God.dumpProcessList)
//       God.dumpProcessList(function() {
//         return process.exit(cst.ERROR_EXIT);
//       });
//     else
//       return process.exit(cst.ERROR_EXIT);
//   }
// });

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
  var env_copy = Common.serialize(env);
  var startingInside = (env_copy['env'] && env_copy['env']['pm_id'] && !env_copy['started_inside']) ? true : false;

  Common.extend(env_copy, env_copy.env);

  env_copy['status']      = cst.LAUNCHING_STATUS;
  env_copy['pm_uptime']   = Date.now();
  env_copy['axm_actions'] = [];
  env_copy['axm_monitor'] = {};
  env_copy['axm_options'] = {};
  env_copy['axm_dynamic'] = {};

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
    env_copy['vizion_running']    = false;
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
      env_copy['watcher'] = God.watch.enable(env_copy);
    }
  }


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

      clu.once('error', function(err) {
        console.error(err.stack || err);
        clu.removeAllListeners();
        clu.process.removeAllListeners();
        God.handleExit(clu, cst.ERROR_EXIT);
      });

      clu.once('exit', function cluExit(exited_clu, code) {
        clu.removeAllListeners();
        clu.process.removeAllListeners();
        God.handleExit(clu, code);
      });

      clu.once('online', function cluOnline() {
        console.log('App name:%s id:%s online', clu.pm2_env.name, clu.pm2_env.pm_id);
        clu.pm2_env.status = cst.ONLINE_STATUS;
        God.finalizeProcedure(clu);
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
        return God.handleExit(proc);
      });

      clu.once('close', function cluClose(code) {
        console.error('App closed with code: ' + code);
        clu.removeAllListeners();
        if (clu.connected == true)
          clu.disconnect();
        clu._reloadLogs = null;
        return God.handleExit(proc, code);
      });

      God.finalizeProcedure(proc);

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

  God.notify('exit', proc);

  if (!stopping)
    proc.pm2_env.restart_time = proc.pm2_env.restart_time + 1;

  if (!stopping && !overlimit)
    this.executeApp(proc.pm2_env);

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
    return God.executeApp(env, function(err, clu) {
      God.notify('start', clu, true);
      cb(err, [Common.serialize(clu)]);
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
  var current_path = path.dirname(proc.pm2_env.pm_exec_path);
  var proc_id      = proc.pm2_env.pm_id;

  if (proc.pm2_env.vizion_running === true) {
    console.log('Vizion is already running for proc id: %d, skipping this round', proc_id);
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
    else if (err && current_path == '/') {
      proc.pm2_env.versioning = null;
      God.notify('online', proc);
    }
    else {
      current_path = path.dirname(current_path);
      proc.pm2_env.vizion_running = true;
      vizion.analyze({folder : current_path}, recur_path);
    }
    return false;
  });
};

require('./Worker.js')(God);
God.Worker.start();
