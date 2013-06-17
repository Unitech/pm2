// pm2-monitor // Code name : God
// by Strzelewicz Alexandre

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var usage   = require('usage');
var path    = p = require('path');
var cst     = require('../constants.js');

cluster.setupMaster({
  exec : p.resolve(p.dirname(module.filename), 'ProcessContainer.js')
});

var God = module.exports = {
  next_id : 0,
  clusters_db : {}
};

//
// Init
//
(function initEngine() {
  cluster.on('online', function(clu) {
    console.log("%s - id%d worker online",
		clu.opts.pm_exec_path,
		clu.pm_id);
    God.clusters_db[clu.pm_id].status = 'online';
  });

  cluster.on('exit', function(clu, code, signal) {
    console.log('Script %s %d exited code %d',
		clu.opts.pm_exec_path,
		clu.pm_id,
		code);

    God.clusters_db[clu.pm_id].status = 'starting';


    // Keep track of the number of restarts
    God.clusters_db[clu.pm_id].opts.restart_time = God.clusters_db[clu.pm_id].opts.restart_time + 1;

    if (clu.opts.max !== undefined) {
      if (clu.opts.max <= 0) {
	God.clusters_db[clu.pm_id].status = 'stopped';
        delete God.clusters_db[clu.pm_id];
	return ;
      }
      else clu.opts.max -= 1;
    }

    if (Date.now() - God.clusters_db[clu.pm_id].opts.pm_uptime < cst.MS_TO_STOP_SCRIPT
       && God.clusters_db[clu.pm_id].opts.restart_time > 5) {
      God.clusters_db[clu.pm_id].status = 'stopped';
      God.clusters_db[clu.pm_id].pid = 0;
    }
    else {
      delete God.clusters_db[clu.pm_id];
      execute(clu.opts);
    }
  });
})();

God.stopAll = function(cb) {
  var pros = God.getFormatedProcesses();
  var l = pros.length;

  (function ex(processes, i) {
    if (i <= -1) return cb(null, God.getFormatedProcesses());
    if (processes[i].state == 'stopped') return ex(processes, i - 1);
    return God.stopProcess(processes[i], function() {
	     ex(processes, i - 1);
	   });
  })(pros, l - 1);
};

God.getProcesses = function() {
  return God.clusters_db;
};

God.getMonitorData = function(cb) {
  var processes = God.getFormatedProcesses();
  var arr = [];

  function ex(i) {
    if (i <= -1) return cb(null, arr);
    var pro = processes[i];

    
    usage.lookup(pro.pid, { keepHistory : true }, function(err, res) {
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
	pid : db[key].process.pid,
	opts : db[key].opts,
	pm_id : db[key].pm_id,
	status : db[key].status
      });
  }
  return arr;
};

God.findByScript = function(script) {
  var db = God.clusters_db;

  for (var key in db) {
    if (db[key].opts.script == script) {
      return db[key].opts;
    }
  }
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

God.startProcess = function(clu, cb) {
  God.clusters_db[clu.pm_id].opts.max = 99;
  execute(God.clusters_db[clu.pm_id].opts, cb);
};

God.startProcessId = function(id, cb) {
  if (God.clusters_db[id] === undefined)
    return cb({ msg : "PM ID unknown"}, {});
  if (God.clusters_db[id].status == "online")
    return cb({ msg : "Process already online"}, {});
  God.clusters_db[id].opts.max = 99;
  return execute(God.clusters_db[id].opts, cb);
};

God.stopProcess = function(clu, cb) {
  God.clusters_db[clu.pm_id].opts.max = 0;
  if (God.clusters_db[clu.pm_id].status != 'stopped')
    process.kill(God.clusters_db[clu.pm_id].process.pid);
  God.clusters_db[clu.pm_id].process.pid = 0;
  setTimeout(cb, 200);
};

God.stopProcessId = function(id, cb) {
  console.log(id);
  God.clusters_db[id].opts.max = 0;
  process.kill(God.clusters_db[id].process.pid);
  God.clusters_db[id].process.pid = 0;
  setTimeout(cb, 200);
};

//
// Public method
//
God.prepare = function(opts, cb) {
  if (opts.instances) {
    // instances "max" have been setted
    // multi fork depending on number of cpus
    var arr = [];
    (function ex(i) {
      if (i <= 0) {
	if (cb != null) return cb(null, arr);
	return true;
      }
      return execute(JSON.parse(JSON.stringify(opts)), function(err, clu) { // deep copy
	       arr.push(clu);
	       ex(i - 1);
	     });
    })(opts.instances);
  }
  else return execute(opts, cb);
};

//
// Private methods
//
function execute(env, cb) {
  var id;

  id = God.next_id;
  God.next_id += 1;

  env['pm_id']     = id;
  env['pm_uptime'] = Date.now();

  // First time the script is exec
  if (env['restart_time'] === undefined) {
    env['restart_time'] = 0;
  }

  var clu = cluster.fork(env);

  clu['pm_id']      = id;
  clu['opts']       = env;
  clu['status']     = 'launching';

  God.clusters_db[id] = clu;

  clu.once('online', function() {
    God.clusters_db[id].status = 'online';
    if (cb) return cb(null, clu);
    return true;
  });

  return clu;
}


// God.watcher = function(script) {
//   console.log('Watching folder : %s', p.dirname(script));
//   var w = watch.watchTree(p.dirname(script), {
//     'ignoreDotFiles' : true
//   }, function(f, curr, prev) {
//        console.log('File changed in %s reloading', script);
//        var procs = God.findByFullPath(script);
//        procs.forEach(function(p) {
//          //console.log(p.process.pid);
//          process.kill(p.process.pid);
//        });
//      });
// };

//God.watcher('/home/tknew/NodeProjects/experimental/examples/echo.js');
