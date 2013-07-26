
//
// Satan is splitted in two parts.
// - The first one is a daemon wrapper around God.js
//   which acts as an RPC server
//      => Satan.remoteWrapper
//
// - The other part is an RPC client which is mainly
//   used by the CLI
//
// by Strzelewicz Alexandre

var rpc    = require("axon-rpc");
var axon   = require("axon");
var rep    = axon.socket("rep");
var req    = axon.socket("req");
var debug  = require("debug")("god:satan");
var events = require("events");
var util   = require("util");
var fs     = require("fs");
var p      = require("path");
var cst    = require('../constants.js');

//
// Get host:port we should bind to
//
var bind = (function(addr) {
  var hostport = String(addr).split(':');
  if (hostport.length < 2) {
    hostport = [undefined, hostport[0]];
  }
  if (hostport[0] == null) {
    hostport[0] = 'localhost';
  }

  return {
    HOST: hostport[0],
    PORT: Number(hostport[1])
  };
})(cst.DAEMON_BIND_ADDR);

var Satan = module.exports = {};

//
// Code switcher
//
Satan.onReady = function() {
  (function init() {
    if (process.env.DAEMON) {
      // ! This env variable is used only for the transitional state of this class
      delete process.env.DAEMON;
      process.title = "pm2: Satan Daemonizer";
      Satan.remoteWrapper();
    }
    else {
      Satan.pingDaemon(function(ab) {
        if (ab == false)
          return Satan.launchDaemon(function(err, child) {
            if (err) {
              console.error(err);
              process.exit(1);
            }
            Satan.launchRPC();
          });
        return Satan.launchRPC();
      });
    }
  })();
};

//
// The code that will be executed on the next process
// Here it exposes God methods
//
Satan.remoteWrapper = function() {

  if (process.env.SILENT == "true") {
    //
    // Redirect output to files
    //
    var stdout = fs.createWriteStream(cst.PM2_LOG_FILE_PATH, { flags : 'a' });

    process.stderr.write = function(string) {
      stdout.write(new Date().toISOString() + ' : ' + string);
    }

    process.stdout.write = function(string) {
      stdout.write(new Date().toISOString() + ' : ' + string);
    }
  }

  // Only require here because God init himself
  var God = require("./God");

  // Send ready message to Satan Client
  process.send({
    online : true, success : true, pid : process.pid
  });

  var server = new rpc.Server(rep);

  rep.bind(bind.PORT, bind.HOST);

  server.expose({
    prepare : function(opts, fn) {
      God.prepare(opts, function(err, clu) {
        fn(null, stringifyOnce(clu, undefined, 0));
      });
    },
    list : function(opts, fn) {
      God.getMonitorData(fn);
    },
    startId : function(opts, fn) {
      God.startProcessId(opts.id, function(err, clu) {
        fn(err, stringifyOnce(clu, undefined, 0));
      });
    },
    stopId : function(opts, fn) {
      God.stopProcessId(opts.id, function(err, clu) {
        if (err)
          fn(new Error('Process not found'));
        else
          fn(err, clu);
      });
    },
    stopProcessName : function(opts, fn) {
      God.stopProcessName(opts.name, fn);
    },
    stopAll : function(opts, fn) {
      God.stopAll(fn);
    },
    killMe : function(fn) {
      console.log('Killing daemon');
      fn(null, {});
      process.exit(0);
    },
    findByScript : function(opts, fn) {
      fn(null, God.findByScript(opts.script));
    },
    daemonData: function(fn) {
      fn(null, {
        pid : process.pid
      });
    }
  });
};

Satan.launchRPC = function() {
  debug('Launching RPC client');
  Satan.client = new rpc.Client(req);
  Satan.ev = req.connect(bind.PORT);
  Satan.ev.on('connect', function() {
    process.emit('satan:client:ready');
  });
};

Satan.getExposedMethods = function(cb) {
  Satan.client.methods(function(err, methods) {
    cb(err, methods);
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

Satan.killDaemon = function(fn) {
  Satan.client.call('killMe', function(err, res) {
    fn(err, res);
  });
};

Satan.launchDaemon = function(cb) {
  console.log('Launching daemon');

  // Todo : Redirect daemon logs
  var child = require("child_process").fork(p.resolve(p.dirname(module.filename), 'Satan.js'), [], {
    silent : false,
    detached: true,
    cwd: process.cwd(),
    env : {
      "DAEMON" : true,
      "SILENT" : cst.DEBUG ? !cst.DEBUG : true,
      "HOME" : process.env.HOME
    },
    stdio: "ignore"
  }, function(err, stdout, stderr) {
       debug(arguments);
     });

  child.unref();

  child.once('message', function(msg) {
    process.emit('satan:daemon:ready');
    console.log(msg);
    return setTimeout(function() {cb(null, child)}, 100); // Put a little time out
  });
};

// TODO : do it better
Satan.pingDaemon = function(cb) {
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
  req.connect(bind.PORT);
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
};

//
// Launch init
//
Satan.onReady();
