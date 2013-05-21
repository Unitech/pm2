/*
 * forever.js: Top level include for the forever module
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */

var fs = require('fs'),
    path = require('path'),
    events = require('events'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    cliff = require('cliff'),
    nconf = require('nconf'),
    nssocket = require('nssocket'),
    timespan = require('timespan'),
    utile = require('utile'),
    winston = require('winston'),
    mkdirp = utile.mkdirp,
    async = utile.async;

var forever = exports;

//
// Setup `forever.log` to be a custom `winston` logger.
//
forever.log = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)()
  ]
});

forever.log.cli();

//
// Setup `forever out` for logEvents with `winston` custom logger.
//
forever.out = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)()
  ]
});

//
// ### Export Components / Settings
// Export `version` and important Prototypes from `lib/forever/*`
//
forever.initialized  = false;
forever.kill         = require('forever-monitor').kill;
forever.checkProcess = require('forever-monitor').checkProcess;
forever.root         = path.join(process.env.HOME || process.env.USERPROFILE || '/root', '.forever');
forever.config       = new nconf.File({ file: path.join(forever.root, 'config.json') });
forever.Forever      = forever.Monitor = require('forever-monitor').Monitor;
forever.Worker       = require('./forever/worker').Worker;
forever.cli          = require('./forever/cli');

//
// Expose version through `pkginfo`
//
require('pkginfo')(module, 'version');

//
// Expose the global forever service
//
forever.__defineGetter__('service', function () {
  return require('./forever/service');
});

//
// ### function getSockets (sockPath, callback)
// #### @sockPath {string} Path in which to look for UNIX domain sockets
// #### @callback {function} Continuation to pass control to when complete
// Attempts to read the files from `sockPath` if the directory does not exist,
// then it is created using `mkdirp`.
//
function getSockets(sockPath, callback) {
  var sockets;

  try {
    sockets = fs.readdirSync(sockPath);
  }
  catch (ex) {
    if (ex.code !== 'ENOENT') {
      return callback(ex);
    }

    return mkdirp(sockPath, '0755', function (err) {
      return err ? callback(err) : callback(null, []);
    });
  }

  callback(null, sockets);
}

//
// ### function getAllProcess (callback)
// #### @callback {function} Continuation to respond to when complete.
// Returns all data for processes managed by forever.
//
function getAllProcesses(callback) {
  var sockPath = forever.config.get('sockPath');

  function getProcess(name, next) {
    var fullPath = path.join(sockPath, name),
        socket = new nssocket.NsSocket();

    socket.connect(fullPath, function (err) {
      if (err) {
        next(err);
      }

      socket.dataOnce(['data'], function (data) {
        data.socket = fullPath;
        next(null, data);
        socket.end();
      });

      socket.send(['data']);
    });

    socket.on('error', function (err) {
      if (err.code === 'ECONNREFUSED') {
        fs.unlink(fullPath, function () {
          next();
        });
      }
      else {
        next();
      }
    });
  }

  getSockets(sockPath, function (err, sockets) {
    if (err || (sockets && sockets.length === 0)) {
      return callback(err);
    }

    async.map(sockets, getProcess, function (err, processes) {
      callback(processes.filter(Boolean));
    });
  });
}

// PIMP : expose getAllProcesses
forever.getAllProcesses = getAllProcesses;

//
// ### function getAllPids ()
// Returns the set of all pids managed by forever.
// e.x. [{ pid: 12345, foreverPid: 12346 }, ...]
//
function getAllPids(processes) {
  return !processes ? null : processes.map(function (proc) {
    return {
      pid: proc.pid,
      foreverPid: proc.foreverPid
    };
  });
}

function stopOrRestart(action, event, format, target) {
  var emitter = new events.EventEmitter(),
      results = [];

  function sendAction(proc, next) {
    var socket = new nssocket.NsSocket();

    socket.connect(proc.socket, function (err) {
      if (err) {
        next(err);
      }

      socket.dataOnce([action, 'ok'], function (data) {
        next();
        socket.end();
      });

      socket.send([action]);
    });

    socket.on('error', function (err) {
      next(err);
    });
  }

  getAllProcesses(function (processes) {
    var procs = processes;

    if (target !== undefined && target !== null) {
      procs = forever.findByIndex(target, processes)
        || forever.findByScript(target, processes)
        || forever.findByUid(target, processes);
    }

    if (procs && procs.length > 0) {
      async.map(procs, sendAction, function (err, results) {
        if (err) {
          emitter.emit('error', err);
        }

        emitter.emit(event, forever.format(format, procs));
      });
    }
    else {
      process.nextTick(function () {
        emitter.emit('error', new Error('Cannot find forever process: ' + target));
      });
    }
  });

  return emitter;
}

//
// ### function load (options, [callback])
// #### @options {Object} Options to load into the forever module
// Initializes configuration for forever module
//
forever.load = function (options) {
  //
  // Setup the incoming options with default options.
  //
  options           = options           || {};
  options.loglength = options.loglength || 100;
  options.logstream = options.logstream || false;
  options.root      = options.root      || forever.root;
  options.pidPath   = options.pidPath   || path.join(options.root, 'pids');
  options.sockPath  = options.sockPath  || path.join(options.root, 'sock');

  //
  // If forever is initalized and the config directories are identical
  // simply return without creating directories
  //
  if (forever.initialized && forever.config.get('root') === options.root &&
    forever.config.get('pidPath') === options.pidPath) {
    return;
  }

  forever.config = new nconf.File({ file: path.join(options.root, 'config.json') });

  //
  // Try to load the forever `config.json` from
  // the specified location.
  //
  try {
    forever.config.loadSync();
  }
  catch (ex) { }

  //
  // Setup the columns for `forever list`.
  //
  options.columns  = options.columns  || forever.config.get('columns');
  if (!options.columns) {
    options.columns = [
      'uid', 'command', 'script', 'forever', 'pid', 'logfile', 'uptime'
    ];
  }

  forever.config.set('root', options.root);
  forever.config.set('pidPath', options.pidPath);
  forever.config.set('sockPath', options.sockPath);
  forever.config.set('loglength', options.loglength);
  forever.config.set('logstream', options.logstream);
  forever.config.set('columns', options.columns);

  //
  // Setup timestamp to event logger
  //
  forever.out.transports.console.timestamp = forever.config.get('timestamp') === 'true';

  //
  // Attempt to see if `forever` has been configured to
  // run in debug mode.
  //
  options.debug = options.debug || forever.config.get('debug') || false;

  if (options.debug) {
    //
    // If we have been indicated to debug this forever process
    // then setup `forever._debug` to be an instance of `winston.Logger`.
    //
    forever._debug();
  }

  //
  // Syncronously create the `root` directory
  // and the `pid` directory for forever. Although there is
  // an additional overhead here of the sync action. It simplifies
  // the setup of forever dramatically.
  //
  function tryCreate(dir) {
    try {
      fs.mkdirSync(dir, '0755');
    }
    catch (ex) { }
  }

  tryCreate(forever.config.get('root'));
  tryCreate(forever.config.get('pidPath'));
  tryCreate(forever.config.get('sockPath'));

  //
  // Attempt to save the new `config.json` for forever
  //
  try {
    forever.config.saveSync();
  }
  catch (ex) { }

  forever.initialized = true;
};

//
// ### @private function _debug ()
// Sets up debugging for this forever process
//
forever._debug = function () {
  var debug = forever.config.get('debug');

  if (!debug) {
    forever.config.set('debug', true);
    forever.log.add(winston.transports.File, {
      level: 'silly',
      filename: path.join(forever.config.get('root'), 'forever.debug.log')
    });
  }
};

//
// Ensure forever will always be loaded the first time it is required.
//
forever.load();

//
// ### function stat (logFile, script, callback)
// #### @logFile {string} Path to the log file for this script
// #### @logAppend {boolean} Optional. True Prevent failure if the log file exists.
// #### @script {string} Path to the target script.
// #### @callback {function} Continuation to pass control back to
// Ensures that the logFile doesn't exist and that
// the target script does exist before executing callback.
//
forever.stat = function (logFile, script, callback) {
  var logAppend;

  if (arguments.length === 4) {
    logAppend = callback;
    callback = arguments[3];
  }

  fs.stat(script, function (err, stats) {
    if (err) {
      return callback(new Error('script ' + script + ' does not exist.'));
    }

    return logAppend ? callback(null) : fs.stat(logFile, function (err, stats) {
      return !err
        ? callback(new Error('log file ' + logFile + ' exists. Use the -a or --append option to append log.'))
        : callback(null);
    });
  });
};

//
// ### function start (script, options)
// #### @script {string} Location of the script to run.
// #### @options {Object} Configuration for forever instance.
// Starts a script with forever
//
forever.start = function (script, options) {
  if (!options.uid) {
    options.uid = options.uid || utile.randomString(4).replace(/^\-/, '_');
  }

  if (!options.logFile) {
    options.logFile = forever.logFilePath(options.uid + '.log');
  }

  //
  // Create the monitor, log events, and start.
  //
  var monitor = new forever.Monitor(script, options);
  forever.logEvents(monitor);
  return monitor.start();
};

//
// ### function startDaemon (script, options)
// #### @script {string} Location of the script to run.
// #### @options {Object} Configuration for forever instance.
// Starts a script with forever as a daemon
//
forever.startDaemon = function (script, options, cb) {
  options         = options || {};
  options.uid     = options.uid || utile.randomString(4).replace(/^\-/, '_');
    
    options.errFile = forever.logFilePath(options.errFile || options.uid + '.log');
    options.outFile = forever.logFilePath(options.outFile || options.uid + '.log');
    
    options.pidFile = forever.pidFilePath(options.pidFile || options.uid + '.pid');

  var monitor, outFD, errFD, workerPath, t;

  //
  // This log file is forever's log file - the user's outFile and errFile
  // options are not taken into account here.  This will be an aggregate of all
  // the app's output, as well as messages from the monitor process, where
  // applicable.
  //

    outFD = fs.openSync(options.outFile, 'a');
    errFD = fs.openSync(options.errFile, 'a');
    monitorPath = path.resolve(__dirname, '..', 'bin', 'monitor');
    
    monitor = spawn(process.execPath, [monitorPath, script], {
	stdio: ['ipc', outFD, errFD],
	detached: true
    });

    // Wait
    t = setTimeout(function() {
	if (cb) return cb(null, monitor);
	return true;
    }, 1000);
    
    monitor.on('exit', function (code) {
	clearTimeout(t);
	if (cb) return cb(code, options.errFile, null);
	return true;
    });
    
    monitor.send(JSON.stringify(options));
    monitor.unref();
    
};

//
// ### function startServer ()
// #### @arguments {forever.Monitor...} A list of forever.Monitor instances
// Starts the `forever` HTTP server for communication with the forever CLI.
// **NOTE:** This will change your `process.title`.
//
forever.startServer = function () {
  var args = Array.prototype.slice.call(arguments),
      monitors = [],
      callback;

  args.forEach(function (a) {
    if (Array.isArray(a)) {
      monitors = monitors.concat(a.filter(function (m) {
        return m instanceof forever.Monitor;
      }));
    }
    else if (a instanceof forever.Monitor) {
      monitors.push(a);
    }
    else if (typeof a === 'function') {
      callback = a;
    }
  });

  async.map(monitors, function (monitor, next) {
    var worker = new forever.Worker({
      monitor: monitor,
      sockPath: forever.config.get('sockPath'),
      exitOnStop: true
    });

    worker.start(function (err) {
      return err ? next(err) : next(null, worker);
    });
  }, callback || function () {});
};


//
// ### function stop (target, [format])
// #### @target {string} Index or script name to stop
// #### @format {boolean} Indicated if we should CLI format the returned output.
// Stops the process(es) with the specified index or script name
// in the list of all processes
//
forever.stop = function (target, format) {
  return stopOrRestart('stop', 'stop', format, target);
};

//
// ### function restart (target, format)
// #### @target {string} Index or script name to restart
// #### @format {boolean} Indicated if we should CLI format the returned output.
// Restarts the process(es) with the specified index or script name
// in the list of all processes
//
forever.restart = function (target, format) {
  return stopOrRestart('restart', 'restart', format, target);
};

//
// ### function restartAll (format)
// #### @format {boolean} Value indicating if we should format output
// Restarts all processes managed by forever.
//
forever.restartAll = function (format) {
  return stopOrRestart('restart', 'restartAll', format);
};

//
// ### function stopAll (format)
// #### @format {boolean} Value indicating if we should format output
// Stops all processes managed by forever.
//
forever.stopAll = function (format) {
  return stopOrRestart('stop', 'stopAll', format);
};

//
// ### function list (format, procs, callback)
// #### @format {boolean} If set, will return a formatted string of data
// #### @callback {function} Continuation to respond to when complete.
// Returns the list of all process data managed by forever.
//
forever.list = function (format, callback) {
  getAllProcesses(function (processes) {
    callback(null, forever.format(format, processes));
  });
};

//
// ### function tail (target, length, callback)
// #### @target {string} Target script to list logs for
// #### @options {length|stream} **Optional** Length of the logs to tail, boolean stream
// #### @callback {function} Continuation to respond to when complete.
// Responds with the latest `length` logs for the specified `target` process
// managed by forever. If no `length` is supplied then `forever.config.get('loglength`)`
// is used.
//
forever.tail = function (target, options, callback) {
  if (!callback && typeof options === 'function') {
    callback = options;
    options.length = 0;
    options.stream = false;
  }

  length = options.length || forever.config.get('loglength');
  stream = options.stream || forever.config.get('logstream');

  var that = this,
      blanks = function (e, i, a) { return e !== '' },
      title = function (e, i, a) { return e.match(/^==>/) },
      args = ['-n', length],
      logs;

  if (stream) args.unshift('-f');

  function tailProcess(procs, next) {
    var map = {},
        count = 0;

    procs.forEach(function (proc) {
      args.push(proc.logFile);
      map[proc.logFile] = { pid: proc.pid, file: proc.file };
      count++;
    });

    tail = spawn('tail', args, {
      stdio: [null, 'pipe', 'pipe'],
    });

    tail.stdio[1].setEncoding('utf8');
    tail.stdio[2].setEncoding('utf8');

    tail.stdio[1].on('data', function (data) {
      chunk = data.split('\n\n');
      chunk.forEach(function (logs) {
        var logs = logs.split('\n').filter(blanks),
            file = logs.filter(title),
            lines,
            proc;

        file.length
          ? proc = map[file[0].split(' ')[1]]
          : proc = map[procs[0].logFile];

        count === 1
          ? lines = logs
          : lines = logs.slice(1);

        lines.forEach(function (line) {
          callback(null, { file: proc.file, pid: proc.pid, line: line });
        });
      });
    });

    tail.stdio[2].on('data', function (err) {
      return callback(err);
    });
  }

  getAllProcesses(function (processes) {
    if (!processes) {
      return callback(new Error('Cannot find forever process: ' + target));
    }

    var procs = forever.findByIndex(target, processes)
      || forever.findByScript(target, processes);

    if (!procs) {
      return callback(new Error('No logs available for process: ' + target));
    }

    tailProcess(procs, callback);
  });
};

//
// ### function findByIndex (index, processes)
// #### @index {string} Index of the process to find.
// #### @processes {Array} Set of processes to find in.
// Finds the process with the specified index.
//
forever.findByIndex = function (index, processes) {
  var indexAsNum = parseInt(index, 10);
  if (indexAsNum == index) {
    var proc = processes && processes[indexAsNum];
  }
  return proc ? [proc] : null;
};

//
// ### function findByScript (script, processes)
// #### @script {string} The name of the script to find.
// #### @processes {Array} Set of processes to find in.
// Finds the process with the specified script name.
//
forever.findByScript = function (script, processes) {
  if (!processes) return null;

  var procs = processes.filter(function (p) {
    return p.file === script;
  });

  if (procs.length === 0) procs = null;

  return procs;
};

//
// ### function findByUid (uid, processes)
// #### @uid {string} The uid of the process to find.
// #### @processes {Array} Set of processes to find in.
// Finds the process with the specified uid.
//
forever.findByUid = function (script, processes) {
  return !processes
    ? null
    : processes.filter(function (p) {
      return p.uid === script;
    });
};

//
// ### function format (format, procs)
// #### @format {Boolean} Value indicating if processes should be formatted
// #### @procs {Array} Processes to format
// Returns a formatted version of the `procs` supplied based on the column
// configuration in `forever.config`.
//
forever.format = function (format, procs) {
  if (!procs || procs.length === 0) {
    return null;
  }

  var index = 0,
      columns = forever.config.get('columns'),
      rows = [['   '].concat(columns)],
      formatted;

  function mapColumns(prefix, mapFn) {
    return [prefix].concat(columns.map(mapFn));
  }

  if (format) {
    //
    // Iterate over the procs to see which has the
    // longest options string
    //
    procs.forEach(function (proc) {
      rows.push(mapColumns('[' + index + ']', function (column) {
        return forever.columns[column]
          ? forever.columns[column].get(proc)
          : 'MISSING';
      }));

      index++;
    });

    formatted = cliff.stringifyRows(rows, mapColumns('white', function (column) {
      return forever.columns[column]
        ? forever.columns[column].color
        : 'white';
    }));
  }

  return format ? formatted : procs;
};

//
// ### function cleanUp ()
// Utility function for removing excess pid and
// config, and log files used by forever.
//
forever.cleanUp = function (cleanLogs, allowManager) {
  var emitter = new events.EventEmitter(),
      pidPath = forever.config.get('pidPath');

  getAllProcesses(function (processes) {
    if (cleanLogs) {
      forever.cleanLogsSync(processes);
    }

    function unlinkProcess(proc, done) {
      fs.unlink(path.join(pidPath, proc.uid + '.pid'), function () {
        //
        // Ignore errors (in case the file doesnt exist).
        //

        if (cleanLogs && proc.logFile) {
          //
          // If we are cleaning logs then do so if the process
          // has a logfile.
          //
          return fs.unlink(proc.logFile, function () {
            done();
          });
        }

        done();
      });
    }

    function cleanProcess(proc, done) {
      if (proc.child && proc.manager) {
        return done();
      }
      else if (!proc.child && !proc.manager
        || (!proc.child && proc.manager && allowManager)
        || proc.dead) {
        return unlinkProcess(proc, done);
      }

      //
      // If we have a manager but no child, wait a moment
      // in-case the child is currently restarting, but **only**
      // if we have not already waited for this process
      //
      if (!proc.waited) {
        proc.waited = true;
        return setTimeout(function () {
          checkProcess(proc, done);
        }, 500);
      }

      done();
    }

    function checkProcess(proc, next) {
      proc.child = forever.checkProcess(proc.pid);
      proc.manager = forever.checkProcess(proc.foreverPid);
      cleanProcess(proc, next);
    }

    if (processes && processes.length > 0) {
      (function cleanBatch(batch) {
        async.forEach(batch, checkProcess, function () {
          return processes.length > 0
            ? cleanBatch(processes.splice(0, 10))
            : emitter.emit('cleanUp');
        });
      })(processes.splice(0, 10));
    }
    else {
      process.nextTick(function () {
        emitter.emit('cleanUp');
      });
    }
  });

  return emitter;
};

//
// ### function cleanLogsSync (processes)
// #### @processes {Array} The set of all forever processes
// Removes all log files from the root forever directory
// that do not belong to current running forever processes.
//
forever.cleanLogsSync = function (processes) {
  var root = forever.config.get('root'),
      files = fs.readdirSync(root),
      running,
      runningLogs;

  running = processes && processes.filter(function (p) {
    return p && p.logFile;
  });

  runningLogs = running && running.map(function (p) {
    return p.logFile.split('/').pop();
  });

  files.forEach(function (file) {
    if (/\.log$/.test(file) && (!runningLogs || runningLogs.indexOf(file) === -1)) {
      fs.unlinkSync(path.join(root, file));
    }
  });
};

//
// ### function logFilePath (logFile)
// #### @logFile {string} Log file path
// Determines the full logfile path name
//
forever.logFilePath = function (logFile, uid) {
  return logFile && (logFile[0] === '/' || logFile[1] === ':')
    ? logFile
    : path.join(forever.config.get('root'), logFile || (uid || 'forever') + '.log');
};

//
// ### function pidFilePath (pidFile)
// #### @logFile {string} Pid file path
// Determines the full pid file path name
//
forever.pidFilePath = function (pidFile) {
  return pidFile && (pidFile[0] === '/' || pidFile[1] === ':')
    ? pidFile
    : path.join(forever.config.get('pidPath'), pidFile);
};

//
// ### @function logEvents (monitor)
// #### @monitor {forever.Monitor} Monitor to log events for
// Logs important restart and error events to `console.error`
//
forever.logEvents = function (monitor) {
  monitor.on('watch:error', function (info) {
    forever.out.error(info.message);
    forever.out.error(info.error);
  });

  monitor.on('watch:restart', function (info) {
    forever.out.error('restarting script because ' + info.file + ' changed')
  });

  monitor.on('restart', function () {
    forever.out.error('Forever restarting script for ' + monitor.times + ' time')
  });

  monitor.on('exit:code', function (code) {
    forever.out.error('Forever detected script exited with code: ' + code);
  });
};

//
// ### @columns {Object}
// Property descriptors for accessing forever column information
// through `forever list` and `forever.list()`
//
forever.columns = {
  uid: {
    color: 'white',
    get: function (proc) {
      return proc.uid;
    }
  },
  command: {
    color: 'grey',
    get: function (proc) {
      return (proc.command || 'node').grey;
    }
  },
  script: {
    color: 'grey',
    get: function (proc) {
      return [proc.file].concat(proc.options).join(' ').grey;
    }
  },
  forever: {
    color: 'white',
    get: function (proc) {
      return proc.foreverPid;
    }
  },
  pid: {
    color: 'white',
    get: function (proc) {
      return proc.pid;
    }
  },
  logfile: {
    color: 'magenta',
    get: function (proc) {
      return proc.logFile ? proc.logFile.magenta : '';
    }
  },
  dir: {
    color: 'grey',
    get: function (proc) {
      return proc.sourceDir.grey;
    }
  },
  uptime: {
    color: 'yellow',
    get: function (proc) {
      return timespan.fromDates(new Date(proc.ctime), new Date()).toString().yellow;
    }
  }
};
