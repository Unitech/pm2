/**
 * Module dependencies
 */

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var usage   = require('usage');
var path    = p = require('path');
var cst     = require('../constants.js');
var util    = require('util');
var log     = require('debug')('pm2:god');
var fs      = require('fs');
var Common  = require('./Common');
var os      = require('os');

var EventEmitter2 = require('eventemitter2').EventEmitter2;

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
 * Handle logic when a process exit (Node or Fork)
 */

function handleExit(clu, exit_code) {
  console.log('Script %s %d exited code %d',
              clu.pm2_env.pm_exec_path,
              clu.pm2_env.pm_id,
              exit_code);

  var stopping   = (clu.pm2_env.status == 'stopping' || clu.pm2_env.status == cst.ERRORED_STATUS) ? true : false;
  var overlimit  = false;

  if (stopping)  clu.process.pid = 0;

  if (clu.pm2_env.status != cst.ERRORED_STATUS)
    clu.pm2_env.status = cst.STOPPED_STATUS;


  /**
   * Avoid infinite reloop if an error is present
   */
  // If the process has been created less than 15seconds ago
  if ((Date.now() - clu.pm2_env.created_at) < 15000) {
    // And if the process has an uptime less than a second
    if ((Date.now() - clu.pm2_env.pm_uptime) < (1000 || clu.pm2_env.min_uptime)) {
      // Increment unstable restart
      clu.pm2_env.unstable_restarts += 1;
    }

    if (clu.pm2_env.unstable_restarts >= 15) {
      // Too many unstable restart in less than 15 seconds
      // Set the process as "ERRORED"
      // And stop to restart it
      clu.pm2_env.status = cst.ERRORED_STATUS;
      console.error('Script %s had too many unstable restarts (%d). Stopped.',
                    clu.pm2_env.pm_exec_path,
                    clu.pm2_env.unstable_restarts);
      God.bus.emit('process:exit:overlimit', clu);
      clu.pm2_env.unstable_restarts = 0;
      clu.pm2_env.created_at = null;
      overlimit = true;
    }
  }

  God.bus.emit('process:exit', clu);

  if (!stopping)
    clu.pm2_env.restart_time = clu.pm2_env.restart_time + 1;

  if (!stopping && !overlimit) executeApp(clu.pm2_env);
};


/**
 * For Node apps - Cluster mode
 * It will wrap the code and enable load-balancing mode
 */

function nodeApp(pm2_env, cb){
  log('Entering in wrap mode');
  var clu;

  if (fs.existsSync(pm2_env.pm_exec_path) == false) {
    console.error('Script ' + pm2_env.pm_exec_path + ' missing');
    return cb(new Error('Script ' + pm2_env.pm_exec_path + ' missing'));
  }

  try {
    clu = cluster.fork(pm2_env);
  } catch(e) { console.error(e); }

  // Receive message from child
  clu.on('message', function(msg) {
    switch (msg.type) {
    case 'uncaughtException':
      God.bus.emit('process:exception', {process : clu, msg : msg.stack});
      break;
    case 'log:out':
      God.bus.emit('log:out', {process : clu, data : msg.data});
      break;
    case 'log:err':
      God.bus.emit('log:err', {process : clu, data : msg.data});
      break;
    default: // Permits to send message to external from the app
      God.bus.emit(msg.type ? msg.type : 'msg', msg);
    }
  });

  // Avoid circular dependency
  delete clu.process._handle.owner;

  clu.once('online', function() {
    if (cb) return cb(null, clu);
    return false;
  });

}

/**
 * For all apps - FORK MODE
 * fork the app
 */

function forkMode(pm2_env, cb) {
  log('Entering in fork mode');
  var spawn = require('child_process').spawn;

  var interpreter = pm2_env.exec_interpreter || 'node';

  var script = [pm2_env.pm_exec_path];

  var out = fs.openSync(pm2_env.pm_out_log_path, 'a');
  var err = fs.openSync(pm2_env.pm_err_log_path, 'a');

  var pidFile = pm2_env.pm_pid_path;

  // Concat args if present
  if (pm2_env.args)
    script = script.concat(eval((pm2_env.args)));

  var cspr = spawn(interpreter, script, {
    env      : pm2_env,
    cwd      : pm2_env.pm_cwd || process.cwd(),
    detached : true,
    stdio    : [ 'ignore', out, err ]
  });

  cspr.unref();
  fs.writeFileSync(pidFile, cspr.pid);

  cspr.once('close', function(status) {
    fs.close(out);
    fs.close(err);
    try {
    fs.unlinkSync(pidFile);
    }catch(e) {}
  });

  // Avoid circular dependency
  delete cspr._handle.owner;



  cspr.process = {};
  cspr.process.pid = cspr.pid;
  pm2_env.status = cst.ONLINE_STATUS;

  if (cb) return cb(null, cspr);
  return false;
}

/**
 * Forced entry to initialize cluster monitoring
 */

(function initEngine() {
  cluster.on('online', function(clu) {
    console.log("%s - id%d worker online", clu.pm2_env.pm_exec_path, clu.pm2_env.pm_id);
    clu.pm2_env.status = cst.ONLINE_STATUS;
    God.bus.emit('process:online', clu);
  });

  cluster.on('exit', function(clu, code, signal) {
    handleExit(clu, code);
  });
})();

/**
 * Launch the specified script (present in env)
 *
 * @param {Mixed} env
 * @param {Function} cb
 * @api private
 */

function executeApp(env, cb) {
  var id;

  if (env['pm_id'] === undefined) {
    id                       = God.next_id;
    God.next_id              += 1;
    env['pm_id']             = id;
    env['restart_time']      = 0;
    env['unstable_restarts'] = 0;
  }
  else {
    id = env['pm_id'];
  }

  if (!env.created_at)
    env['created_at']        = Date.now();

  env['pm_uptime']  = Date.now();
  env['status']     = 'launching';

  // Raw env copy
  var post_env = JSON.parse(JSON.stringify(env));

  util._extend(post_env, env.env);

  if (env['exec_mode'] == 'fork_mode') {
    // If fork mode enabled
    forkMode(post_env, function(err, clu) {
      clu['pm2_env']             = env;
      clu.pm2_env.status         = cst.ONLINE_STATUS;
      God.clusters_db[env.pm_id] = clu;

      clu.once('error', function(err) {
        console.log(err);
        clu.pm2_env.status = cst.ERRORED_STATUS;
      });

      clu.once('close', function(code) {
        handleExit(clu, code);
      });

      God.bus.emit('process:online', clu);
      if(cb) cb(null, clu);
      return false;
    });
  }
  else {
    // Code wrap enabled
    nodeApp(post_env, function(err, clu) {
      if (err) return cb(err);
      clu['pm2_env']             = env;
      clu.pm2_env.status         = cst.ONLINE_STATUS;
      God.clusters_db[env.pm_id] = clu;
      if(cb) cb(null, clu);
      return false;
    });
  }
  return false;
}

/**
 * First step before execution
 * Check if the -i parameter has been passed
 * so we execute the app multiple time
 *
 * @param {Mixed} env
 * @api public
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
      return executeApp(JSON.parse(JSON.stringify(env)), function(err, clu) { // deep copy
        if (err) return ex(i - 1);
        arr.push(clu);
        ex(i - 1);
      });
    })(env.instances);
  }
  else {
    return executeApp(env, function(err, dt) {
      cb(err, dt);
    });
  }
  return false;
};

/**
 * Allows an app to be prepared using the same json format as the CLI, instead
 * of the internal PM2 format.
 * An array of applications is not currently supported. Call this method
 * multiple times with individual app objects if you have several to start.
 * @param app {Object}
 * @param [cwd] {string} Optional string to specify the cwd for the script.
 * @param cb {Function}
 * @returns {*}
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

God.stopAll = function(env, cb) {
  var pros = God.getFormatedProcesses();
  var l = pros.length;

  (function ex(processes, i) {
    if (i <= -1) return cb(null, God.getFormatedProcesses());
    if (processes[i].state == cst.STOPPED_STATUS) return ex(processes, i - 1);
    return God.stopProcessId(processes[i].pm2_env.pm_id, function() {
             ex(processes, i - 1);
           });
  })(pros, l - 1);
};

God.reload = function reload(env, cb) {
  var workerAmount = 0;
  for (var id in God.clusters_db) {
    if (God.clusters_db[id].pm2_env.exec_mode == 'cluster_mode') {
      workerAmount++;
      (function (oldWorker, currentWorkerIndex) {
        executeApp(oldWorker.pm2_env, function(err, newWorker) {
          newWorker.once('listening', function(){
            console.log("%s - id%d worker listening",
                        newWorker.pm2_env.pm_exec_path,
                        newWorker.pm2_env.pm_id);
            oldWorker.once('disconnect', function(){
              console.log('%s - id%d worker disconnect',
                          oldWorker.pm2_env.pm_exec_path,
                          oldWorker.pm2_env.pm_id);

              God.stopProcessId(oldWorker.pm2_env.pm_id, function(){
                if(currentWorkerIndex === workerAmount){
                  setTimeout(cb, 2000);
                }
              });
            });
            oldWorker.disconnect();
          });
        });
      })(God.clusters_db[id], workerAmount);
    }
  }
};

God.getProcesses = function() {
  return God.clusters_db;
};

God.getMonitorData = function(env, cb) {
  var processes = God.getFormatedProcesses();
  var arr = [];

  function ex(i) {
    if (i <= -1) return cb(null, arr);
    var pro = processes[i];

    if (pro.pm2_env.status != cst.STOPPED_STATUS &&
        pro.pm2_env.status != cst.ERRORED_STATUS) {
      console.log(pro.pid);
      usage.lookup(pro.pid, { keepHistory : true }, function(err, res) {
        if (err)
          return cb(new Error('Looks like a process in on infinite loop, wait 10s to get more informations'));

        pro['monit'] = res;
        arr.push(pro);
        return ex(i - 1);
      });
    } else {
      pro['monit'] = {memory : 0, cpu : 0};
      arr.push(pro);
      return ex(i - 1);
    }
    return false;
  };

  ex(processes.length - 1);
};

God.getSystemData = function(env, cb) {
  God.getMonitorData(env, function(err, processes) {
    cb(err, {
      system: {
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpus: os.cpus(),
        load: os.loadavg(),
        memory: {
          free: os.freemem(),
          total: os.totalmem()
        }
      },
      processes: processes
    });
  });
};

God.getFormatedProcesses = function() {
  var db = God.clusters_db;
  var arr = [];

  for (var key in db) {
    if (db[key])
      arr.push({
        pid    : db[key].process.pid,
        name : db[key].name,
        pm2_env   : db[key].pm2_env,
        pm_id  : db[key].pm2_env.pm_id
      });
  }
  return arr;
};

God.findProcessById = function(id) {
  return God.clusters_db[id] ? God.clusters_db[id] : null;
};

God.findByScript = function(script, cb) {
  var db = God.clusters_db;
  var arr = [];

  for (var key in db) {
    if (p.basename(db[key].pm2_env.pm_exec_path) == script) {
      arr.push(db[key].pm2_env);
    }
  }
  cb(null, arr.length == 0 ? null : arr);
};

God.findByPort = function(port, cb) {
  var db = God.clusters_db;
  var arr = [];

  for (var key in db) {
    if (db[key].pm2_env.port && db[key].pm2_env.port == port) {
      arr.push(db[key].pm2_env);
    }
  }
  cb(null, arr.length == 0 ? null : arr);
};

God.findByFullPath = function(path, cb) {
  var db = God.clusters_db;
  var procs = [];

  for (var key in db) {
    if (db[key].pm2_env.pm_exec_path == path) {
      procs.push(db[key]);
    }
  }
  cb(null, procs.length == 0 ? null : procs);
};

/**
 * Check if a process is alive in system processes
 */

God.checkProcess = function(pid) {
  if (!pid) return false;

  try {
    // Sending 0 signal do not kill the process
    process.kill(pid, 0);
    return true;
  }
  catch (err) {
    return false;
  }
};

/**
 * Start a stopped process by ID
 */

God.startProcessId = function(id, cb) {
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  if (God.clusters_db[id].pm2_env.status == "online")
    return cb(new Error({ msg : "Process already online"}), {});
  return executeApp(God.clusters_db[id].pm2_env, cb);
};

/**
 * Stop a process and set it on state "stopped"
 */

God.stopProcessId = function(id, cb) {
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  if (God.clusters_db[id].pm2_env.status == cst.STOPPED_STATUS)
    return cb(null, God.getFormatedProcesses());

  God.clusters_db[id].pm2_env.status = 'stopping';
  if (God.clusters_db[id].process.pid != 0) {
    try {
      process.kill(God.clusters_db[id].process.pid);
    } catch(e) {}
  }
  setTimeout(function() {
    cb(null, God.getFormatedProcesses());
  }, 200);
};

/**
 * Delete a process by id
 * It will stop it and remove it from the database
 */

God.deleteProcessId = function(id, cb) {
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  God.stopProcessId(id, function(err, dt) {
    delete God.clusters_db[id];
    setTimeout(function() {
      cb(null, God.getFormatedProcesses());
    }, 200);
  });
};
/**
 * Restart a process ID
 * If the process is online it will not put it on state stopped
 * but directly kill it and let God restart it
 */

God.restartProcessId = function(id, cb) {
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  var proc = God.clusters_db[id];

  if (proc.pm2_env.status == cst.ONLINE_STATUS) {
    process.kill(proc.process.pid);
    setTimeout(function() {
      cb(null, God.getFormatedProcesses());
    }, 200);
  }
  else
    God.startProcessId(id, cb);
  return false;
};

/**
 * Restart all process by name
 */

God.restartProcessName = function(name, cb) {
  var arr = Object.keys(God.clusters_db);

  (function ex(arr) {
    if (arr[0] == null) return cb(null, God.getFormatedProcesses());

    var key      = arr[0];
    var proc_env = God.clusters_db[key].pm2_env;

    if (p.basename(proc_env.pm_exec_path) == name || proc_env.name == name) {
      if (proc_env.status == cst.ONLINE_STATUS) {
        process.kill(God.clusters_db[key].process.pid);
        setTimeout(function() {
          arr.shift();
          return ex(arr);
        }, 200);
      }
      else if (proc_env.status == cst.STOPPED_STATUS) {
        God.startProcessId(proc_env.pm_id, function() {
          arr.shift();
          return ex(arr);
        });
      }
    }
    else {
      arr.shift();
      return ex(arr);
    }
    return false;
  })(arr);
};

/**
 * Stop all process by name
 */

God.stopProcessName = function(name, cb) {
  var arr = Object.keys(God.clusters_db);
  var stopped_proc = 0;

  (function ex(arr) {
    if (arr[0] == null) {
      if (stopped_proc == 0)
        return cb(new Error('No process stopped'));
      return cb(null, God.getFormatedProcesses());
    }
    var key = arr[0];
    if ((p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == name ||
         p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == p.basename(name) ||
         God.clusters_db[key].pm2_env.name == name) &&
        God.clusters_db[key].pm2_env.status != cst.STOPPED_STATUS) {
      stopped_proc++;
      God.stopProcessId(God.clusters_db[key].pm2_env.pm_id, function() {
        arr.shift();
        return ex(arr);
      });
    }
    else {
      arr.shift();
      return ex(arr);
    }
    return false;
  })(arr);
};

/**
 * Delete a process by name
 * It will stop it and remove it from the database
 */

God.deleteProcessName = function(name, cb) {
  var arr = Object.keys(God.clusters_db);

  (function ex(arr) {
    if (arr[0] == null) return cb(null, God.getFormatedProcesses());
    var key = arr[0];
    if (p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == name ||
        God.clusters_db[key].pm2_env.name == name) {
      God.stopProcessId(God.clusters_db[key].pm2_env.pm_id, function() {
        arr.shift();
        delete God.clusters_db[key];
        return ex(arr);
      });
    }
    else {
      arr.shift();
      return ex(arr);
    }
    return false;
  })(arr);
};


/**
 * Delete all processes
 * It will stop them and remove them from the database
 */

God.deleteAll = function(opts, cb) {
  var arr = Object.keys(God.clusters_db);

  (function ex(arr) {
    if (arr[0] == null) return cb(null, God.getFormatedProcesses());
    var key = arr[0];
    God.stopProcessId(God.clusters_db[key].pm2_env.pm_id, function() {
      arr.shift();
      delete God.clusters_db[key];
      return ex(arr);
    });
    return false;
  })(arr);
};

/**
 * Kill PM2 Daemon
 */

God.killMe = function(env, cb) {
  for (var id in God.clusters_db) {
    God.stopProcessId(id, function() {});
  };
  God.bus.emit('pm2:kill', {
    status : 'killed',
    msg : 'pm2 has been killed via method'
  });
  setTimeout(function() {
    cb(null, {msg : 'pm2 killed'});
    process.exit(cst.SUCCESS_EXIT);
  }, 1000);
};
