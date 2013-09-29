
/**
 * Module dependencies
 */

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var usage   = require('usage');
var path    = p = require('path');
var cst     = require('../constants.js');
var util   = require('util');

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
 * Forced entry to initialize engine
 */

(function initEngine() {
  cluster.on('online', function(clu) {
    console.log("%s - id%d worker online", clu.pm2_env.pm_exec_path, clu.pm2_env.pm_id);
    clu.pm2_env.status = 'online';
    God.bus.emit('process:online', clu);
  });

  cluster.on('exit', function(clu, code, signal) {
    console.log('Script %s %d exited code %d',
                clu.pm2_env.pm_exec_path,
                clu.pm2_env.pm_id,
                code);

    var stopping   = clu.pm2_env.status == 'stopping' ? true : false;

    if (stopping)  clu.process.pid = 0;
    
    clu.pm2_env.status = 'stopped';
    God.bus.emit('process:exit', clu);
    
    var overlimit = false;
    var uptime    = Date.now() - clu.pm2_env.pm_uptime;

    // Keep track of the number of restarts
    if (!stopping)
      clu.pm2_env.restart_time = clu.pm2_env.restart_time + 1;

    if (!clu.pm2_env.min_uptime || uptime <= clu.pm2_env.min_uptime)
      clu.pm2_env.unstable_restarts += 1;
    
    if (clu.pm2_env.max_restarts &&
        clu.pm2_env.unstable_restarts >= clu.pm2_env.max_restarts) {
      overlimit = true;
      console.log('Script %s had too many unstable restarts (%d). Stopped.',
                  clu.pm2_env.pm_exec_path,
                  clu.pm2_env.unstable_restarts);
    }

    if (!stopping && !overlimit) executeNodeApps(clu.pm2_env);
  });
})();

/**
 * Launch the specified script (present in env)
 *
 * @param {Mixed} env
 * @param {Function} cb 
 * @api private
 */

function executeNodeApps(env, cb) {
  var id;

  if (env['pm_id'] === undefined) {
    id                  = God.next_id;
    God.next_id        += 1;
    env['pm_id']        = id;
    env['restart_time'] = 0;
    // Keep track of unstable restarts
    // i.e. restarts that are too fast
    env['unstable_restarts'] = 0;
  }
  else {
    id = env['pm_id'];
  }
  
  env['pm_uptime']  = Date.now();
  env['status']     = 'launching';
  
  // Merge env
  var post_env = JSON.parse(JSON.stringify(env));
  
  util._extend(post_env, env.env);

  function nodeApp(cb){
    var clu;
    
    try {
      clu = cluster.fork(post_env);
    } catch(e) { console.error(e); }
    
    // Receive message from child
    clu.on('message', function(msg) {
      switch (msg.type) {
      case 'uncaughtException':
        God.bus.emit('process:exception', {process : clu, msg : msg.stack});
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
  
  function script(cb) {
    var spawn = require('child_process').spawn;
    var fs = require('fs');
    
    var cmd_params = env.pm_exec_path.split(' ');
    var main_cmd = cmd_params.shift();

    var out = fs.openSync(env.pm_out_log_path, 'a');
    var err = fs.openSync(env.pm_err_log_path, 'a');

    var pidFile = [process.env.pm_pid_path, env.pm_id, '.pid'].join('');
    
    var cspr = spawn(main_cmd, cmd_params, {
      env : post_env,
      cwd        : process.cwd(),
      detached : true,
      stdio: [ 'ignore', out, err ]
    });
    
    cspr.unref();

    // Avoid circular dependency
    delete cspr._handle.owner;
      
    fs.writeFileSync(pidFile, cspr.pid);

    cspr.on('error', function() {
      console.log('eroror');
    });
    
    cspr.on('close', function() {
      fs.unlinkSync(pidFile);
      console.log('exit', arguments);
    });

    cspr.process = {};
    cspr.process.pid = cspr.pid;
    env.status = 'online';
    return cb(null, cspr);
  }      

  // script(function(clu) {
  //   clu['pm2_env']       = env;
  //   God.clusters_db[id] = clu;
  //   cb(null, clu);
  // });
  
  nodeApp(function(err, clu) {
    clu['pm2_env']             = env;
    clu.pm2_env.status         = 'online';
    God.clusters_db[env.pm_id] = clu;
    if(cb) cb(null, clu);
    return false;
  });
  //return nodeApp();
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
      return executeNodeApps(JSON.parse(JSON.stringify(env)), function(err, clu) { // deep copy
        arr.push(clu);
        ex(i - 1);
      });
    })(env.instances);
  }
  else {
    return executeNodeApps(env, function(err, dt) {
      cb(err, dt);
    });
  }
  return false;
};

God.stopAll = function(env, cb) {
  var pros = God.getFormatedProcesses();
  var l = pros.length;

  (function ex(processes, i) {
    if (i <= -1) return cb(null, God.getFormatedProcesses());
    if (processes[i].state == 'stopped') return ex(processes, i - 1);
    return God.stopProcessId(processes[i].pm2_env.pm_id, function() {
             ex(processes, i - 1);
           });
  })(pros, l - 1);
};

God.reload = function reload(env, cb) {
  var workerAmount = 0;
  for (var id in God.clusters_db) {
    workerAmount++;
    (function (oldWorker, currentWorkerIndex) {
      var newWorker = executeNodeApps(oldWorker.env);
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
              cb();
            }
          });
        });
        oldWorker.disconnect();
      });
    })(God.clusters_db[id], workerAmount);
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

    if (pro.pm2_env.status != 'stopped') {
      usage.lookup(pro.pid, { keepHistory : true }, function(err, res) {
        if (err) return cb(err);
        
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

God.findByFullPath = function(path) {
  var db = God.clusters_db;
  var procs = [];

  for (var key in db) {
    if (db[key].pm2_env.pm_exec_path == path) {
      procs.push(db[key]);
    }
  }
  return procs;
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
  return executeNodeApps(God.clusters_db[id].pm2_env, cb);
};

/**
 * Stop a process and set it on state "stopped"
 */

God.stopProcessId = function(id, cb) {  
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  God.clusters_db[id].pm2_env.status = 'stopping';
  if (God.clusters_db[id].process.pid != 0)
    process.kill(God.clusters_db[id].process.pid);
  setTimeout(function() {
    cb(null, God.getFormatedProcesses());
  }, 200);
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

  if (proc.pm2_env.status == 'online') {
    process.kill(proc.process.pid);
    setTimeout(function() {
      cb(null, God.getFormatedProcesses());
    }, 200);
  }
  else if (proc.pm2_env.status == 'stopped')
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
      if (proc_env.status == 'online') {
        process.kill(God.clusters_db[key].process.pid);
        setTimeout(function() {
          arr.shift();
          return ex(arr);
        }, 200);
      }
      else if (proc_env.status == 'stopped') {
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
  
  (function ex(arr) {
    if (arr[0] == null) return cb(null, God.getFormatedProcesses());
    var key = arr[0];
    if (p.basename(God.clusters_db[key].pm2_env.pm_exec_path) == name ||
        God.clusters_db[key].pm2_env.name == name &&
        God.clusters_db[key].pm2_env.status != 'stopped') {
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

God.deleteProcess = function(name, cb) {
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
  cb(null, {msg : 'pm2 killed'});
  process.exit(cst.SUCCESS_EXIT);
};
