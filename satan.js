
var rpc = require('axon-rpc');
var axon = require('axon');
var rep = axon.socket('rep');
var req = axon.socket('req');
var debug = require('debug')('god:satan');
var God = require('./god.js');
var events = require("events");
var util = require("util");

const SATAN_PORT = 66666;

var Satan = module.exports = {   
};

//
// The code that will be executed on the next process
//
Satan.remoteWrapper = function() {
    // Send ready message to Satan Client
    process.send({
	online : true, success : true, pid : process.pid
    });
    
    var server = new rpc.Server(rep);
    
    rep.bind(66666);
    
    server.expose({
	prepare : function(opts, fn) {
	    God.prepare(opts, function(err, clu) {
		fn(null, stringifyOnce(clu, undefined, 0));
	    });
	},
	list : function(opts, fn) {
	    God.getMonitorData(fn);
	},
	stop : function(opts, fn) {
	    God.stopAll(fn);
	}
    });
};

Satan.onReady = function() {
    (function init() {
	if (process.env.DAEMON) {
	    Satan.remoteWrapper();
	}
	else {
	    isDaemonReachable(function(ab) {
		if (ab == false)
		    return Satan.launchDaemon(Satan.launchRPC);
		return Satan.launchRPC();
	    });
	}
    })();    
};

Satan.launchRPC = function() {
    debug('Launching RPC client');
    Satan.client = new rpc.Client(req);
    this.ev = req.connect(66666);
    this.ev.on('connect', function() {
	process.emit('satan:ready');
    });
};

//
// Interface to connect to the client
//
Satan.executeRemote = function(method, opts, fn) {
    Satan.client.call(method, opts, function(err, res) {
	fn(err, res);
    });
};

Satan.launchDaemon = function(cb) {
    debug('Launching daemon');
    
    var path = require('path');
    
    var child = require("child_process").fork(path.resolve("./satan.js"), [], {
	silent : false,
	detached: true,
	cwd: process.cwd(),
	env : {
	    "DAEMON" : true
	},
	stdio: "ignore"
    }, function(err, stdout, stderr) {
	debug(arguments);
	//console.log(stdout);
    });
    
    child.unref();
    
    child.once('message', function(msg) {
	console.log(msg);
	return cb(child);
    });
};


// Change Circular dependies to null
function stringifyOnce(obj, replacer, indent){
    var printedObjects = [];
    var printedObjectKeys = [];

    function printOnceReplacer(key, value){
	var printedObjIndex = false;
	printedObjects.forEach(function(obj, index){
	    if(obj===value){
		printedObjIndex = index;
	    }
	});

	if(printedObjIndex && typeof(value)=="object"){
	    return "null";
	}else{
	    var qualifiedKey = key || "(empty key)";
	    printedObjects.push(value);
	    printedObjectKeys.push(qualifiedKey);
	    if(replacer){
		return replacer(key, value);
	    }else{
		return value;
	    }
	}
    }
    return JSON.stringify(obj, printOnceReplacer, indent);
}

// TODO : do it better
function isDaemonReachable(cb) {
    var req = axon.socket('req');
    var client = new rpc.Client(req);

    debug('Trying to connect to server');
    client.sock.once('reconnect attempt', function() {
	client.sock.close();
	debug('Daemon not launched');
	cb(false);
    });
    client.sock.once('connect', function() {
	client.sock.close();
	debug('Daemon alive');
	cb(true);
    });
    req.connect(66666);    
}

Satan.onReady();
