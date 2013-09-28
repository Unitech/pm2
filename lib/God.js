
/**
 * Module dependencies
 */

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var usage   = require('usage');
var path    = p = require('path');
var cst     = require('../constants.js');

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
    console.log("%s - id%d worker online", clu.opts.pm_exec_path, clu.pm_id);
    clu.status = 'online';    
    God.bus.emit('process:online', clu);
  });

  cluster.on('exit', function(clu, code, signal) {
    God.bus.emit('process:exit', clu);
    
    var stopped   = clu.process.pid == -1 ? true : false;
    var overlimit = false;
    var uptime    = Date.now() - clu.opts.pm_uptime;

    console.log('Script %s %d exited code %d',
                clu.opts.pm_exec_path,
                clu.pm_id,
                code);

    // Keep track of the number of restarts
    clu.opts.restart_time = clu.opts.restart_time + 1;

    if (!clu.opts.min_uptime || uptime <= clu.opts.min_uptime)
      clu.opts.unstable_restarts += 1;
    
    if (clu.opts.max_restarts &&
        clu.opts.unstable_restarts >= clu.opts.max_restarts) {
      overlimit = true;
      console.log('Script %s had too many unstable restarts (%d). Stopped.',
                  clu.opts.pm_exec_path,
                  clu.opts.unstable_restarts);
    }
       
    delete God.clusters_db[clu.pm_id];

    if (!stopped && !overlimit) executeNodeApps(clu.opts);
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
  
  // If we stop the process
  // Remove it from the process array
  if (env.pm_id && env.opts && env.opts.status == 'stopped') {
    delete God.clusters_db[env.pm_id];
  }
  
  id = God.next_id;
  God.next_id += 1;

  env['pm_id']     = id;
  env['pm_uptime'] = Date.now();

  // First time the script is exec
  if (env['restart_time'] === undefined)
    env['restart_time'] = 0;

  // Keep track of unstable restarts
  // i.e. restarts that are too fast
  if (env['unstable_restarts'] === undefined)
    env['unstable_restarts'] = 0;

  var clu = cluster.fork(env);  

  // Receive message from child
  clu.on('message', function(msg) {
    switch (msg.type) {
    case 'uncaughtException':
      God.bus.emit('process:exception', clu);
      break;
    default: // Permits to send message to external from the app
      God.bus.emit(msg.type ? msg.type : 'msg', msg);
    }
  });
  
  // Avoid circular dependency
  delete clu.process._handle.owner;
  
  clu['pm_id']      = id;
  clu['opts']       = env;
  clu['status']     = 'launching';

  God.clusters_db[id] = clu;

  clu.once('online', function() {
    clu.status = 'online';
    if (cb) return cb(null, clu);
    return false;
  });

  return clu;
}

/**
 * First step before execution
 * Check if the -i parameter has been passed
 * so we execute the app multiple time
 *
 * @param {Mixed} opts
 * @api public
 */

God.prepare = function(opts, cb) {
  // If instances option is set (-i [arg])
  if (opts.instances) {
    if (opts.instances == 'max') opts.instances = numCPUs;
    opts.instances = parseInt(opts.instances);
    // multi fork depending on number of cpus
    var arr = [];
    (function ex(i) {
      if (i <= 0) {
        if (cb != null) return cb(null, arr);
        return false;
      }
      return executeNodeApps(JSON.parse(JSON.stringify(opts)), function(err, clu) { // deep copy
        arr.push(clu);
        ex(i - 1);
      });
    })(opts.instances);
  }
  else {
    return executeNodeApps(opts, function(err, dt) {
      cb(err, dt);
    });
  }
  return false;
};

God.stopAll = function(opts, cb) {
  var pros = God.getFormatedProcesses();
  var l = pros.length;

  (function ex(processes, i) {
    if (i <= -1) return cb(null, God.getFormatedProcesses());
    if (processes[i].state == 'stopped') return ex(processes, i - 1);
    return God.stopProcessId(processes[i].pm_id, function() {
             ex(processes, i - 1);
           });
  })(pros, l - 1);
};

God.reload = function reload(opts, cb) {
  var workerAmount = 0;
  for (var id in God.clusters_db) {
    workerAmount++;
    (function (oldWorker, currentWorkerIndex) {
      var newWorker = executeNodeApps(oldWorker.opts);
      newWorker.once('listening', function(){
        console.log("%s - id%d worker listening",
          newWorker.opts.pm_exec_path,
          newWorker.pm_id);
        oldWorker.once('disconnect', function(){
          console.log('%s - id%d worker disconnect',
            oldWorker.opts.pm_exec_path,
            oldWorker.pm_id);
          God.stopProcessId(oldWorker.pm_id, function(){
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

God.getMonitorData = function(opts, cb) {
  var processes = God.getFormatedProcesses();
  var arr = [];

  function ex(i) {
    if (i <= -1) return cb(null, arr);
    var pro = processes[i];
    
    usage.lookup(pro.pid, { keepHistory : true }, function(err, res) {
      if (err) return cb(err);

      pro['monit'] = res;
      arr.push(pro);
      return ex(i - 1);
    });
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
        opts   : db[key].opts,
        pm_id  : db[key].pm_id,
        status : db[key].status
      });
  }
  return arr;
};

God.findByScript = function(script, cb) {
  var db = God.clusters_db;

  for (var key in db) {
    if (db[key].opts.script == script) {
      if (cb) return cb(null, db[key].opts);
      return db[key].opts;
    }
  }
  if (cb) return cb(null, null);
  return null;
};

God.findByFullPath = function(path) {
  var db = God.clusters_db;
  var procs = [];

  for (var key in db) {
    if (db[key].opts.pm_exec_path == path) {
      procs.push(db[key]);
    }
  }
  return procs;
};

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

God.startProcessId = function(id, cb) {
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  if (God.clusters_db[id].status == "online")
    return cb(new Error({ msg : "Process already online"}), {});
  return executeNodeApps(God.clusters_db[id].opts, cb);
};

God.stopProcessId = function(id, cb) {  
  if (!(id in God.clusters_db))
    return cb(new Error({msg : "PM ID unknown"}), {});
  process.kill(God.clusters_db[id].process.pid);
  God.clusters_db[id].process.pid = -1;
  setTimeout(function() {
    cb(null, God.getFormatedProcesses());
  }, 200);
};

God.stopProcessName = function(name, cb) {
  var arr = Object.keys(God.clusters_db);
  
  (function ex(arr) {
    if (arr[0] == null) return cb(null, God.getFormatedProcesses());
    var key = arr[0];
    if (p.basename(God.clusters_db[key].opts.pm_exec_path) == name ||
        God.clusters_db[key].opts.name == name) {
      God.stopProcessId(God.clusters_db[key].pm_id, function() {
        arr.shift();
        return ex(arr);
      });
    }
    else {
      arr.shift();
      return ex(arr);
    } 
  })(arr);
};

God.killMe = function(opts, cb) {
  cb(null, {msg : 'pm2 killed'});
  process.exit(cst.SUCCESS_EXIT);
};
