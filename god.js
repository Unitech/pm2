// God.
// by Strzelewicz Alexandre

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var usage = require('usage');
var async = require('async');
var path = require('path');

cluster.setupMaster({
    exec : path.resolve('child_wrapper.js')
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
		    clu.opts.script,
		    clu.pm_id);
	God.clusters_db[clu.pm_id].status = 'online';
    });
        
    cluster.on('exit', function(clu, code, signal) {	
	console.log('Script %s %d exited code %d',
		    clu.opts.script,
		    clu.pm_id,
		    code);

	God.clusters_db[clu.pm_id].status = 'starting';
	
	//delete God.clusters_db[clu.pm_id];
	
	if (clu.opts.max !== undefined) {
	    if (clu.opts.max <= 0) {
		God.clusters_db[clu.pm_id].status = 'stopped';
		return ;
	    }
	    else clu.opts.max -= 1;
	}
	execute(clu.opts);
    });
})();

//
// Public method
//
God.prepare = function(opts, cb) {
    if (opts.instances) {
	// instances "max" have been setted
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
	})(numCPUs);
    }
    else return execute(opts, cb);
};

God.stopAll = function(cb) {
    var pros = God.getFormatedProcesses();
    var l = pros.length;

    (function ex(processes, i) {
	if (i <= -1) return cb(null, God.getFormatedProcesses());
	if (processes[i].state == 'stopped')
	    return ex(processes, i - 1);
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
    execute(God.clusters_db[clu.pm_id].opts);
};

God.stopProcess = function(clu, cb) {
    God.clusters_db[clu.pm_id].opts.max = 0;    
    process.kill(God.clusters_db[clu.pm_id].process.pid);
    God.clusters_db[clu.pm_id].process.pid = 0;
    setTimeout(cb, 200);
};

//
// Private methods
//
function execute(opts, cb) {
    var id;

    if (opts.pm_id)
	id = opts.pm_id;
    else {
	id = God.next_id;
	God.next_id += 1;
    }

    var clu = cluster.fork({
	pm_script  : opts.script,
	pm_errFile : opts.fileError,
	pm_outFile : opts.fileOutput,
	pm_pidFile : opts.pidFile,
	pm_id      : id
    });   
    
    opts['pm_id']    = id;
    clu['pm_id']     = id;
    clu['opts']      = opts;
    clu['status']    = 'launching';


    God.clusters_db[clu.pm_id] = clu;

    clu.once('online', function() {
	God.clusters_db[clu.pm_id].status = 'online';
	if (cb) return cb(null, clu);
	return true;
    });

    // Should fix it
    // DONT use it for now !!
    clu.start = function(cb) {
	var self = this;

	execute(this.opts, function(err, clu) {
	    cb(err, clu);
	});
    };
    
    clu.stop = function(cb) {

    };
    
    return clu;
}


// (function exec() {

//     God.prepare({
// 	script : './examples/child.js',
// 	fileError : 'logs/errLog.log',
// 	fileOutput : 'logs/outLog.log',
// 	pidFile : 'pids/child',
// 	max : 2,
// 	instances : 'max'
//     });
    
//     God.prepare({
// 	script : './examples/echo.js',
// 	fileError : 'logs/echoErr.log',
// 	fileOutput : 'logs/echoLog.log',
// 	pidFile : 'pids/child'
//     });

//     setInterval(function() {
// 	//console.log(God.clusters_db);
//     	God.getMonitorData(function(dt) {
//     	    console.log(dt);
//     	});
//     }, 1000);
// })();
