/**!
 * treekill - index.js
 *
 * Copyright(c) fengmk2 and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 *
 * Github:
 *   https://github.com/node-modules/treekill
 */

/**
 * Module dependencies.
 */

var childProcess = require('child_process');
var spawn = childProcess.spawn;
var exec = childProcess.exec;
var isWindows = process.platform === 'win32';
var isDarwin = process.platform === 'darwin';

module.exports = treekill;

function treekill(pid, signal, callback) {
  if (typeof signal === 'function') {
    callback = signal;
    signal = null;
  }

  if (isWindows) {
    exec('taskkill /pid ' + pid + ' /T /F');
  } else {
    var tree = {};
    tree[pid] = [];
    var pidsToProcess = {};
    pidsToProcess[pid] = 1;
    buildProcessTree(pid, tree, pidsToProcess, function () {
      killAll(tree, signal);
      if (typeof callback === 'function') {
        callback();
      }
    });
  }
}

function killAll(tree, signal) {
  var killed = {};
  Object.keys(tree).forEach(function (pid) {
    tree[pid].forEach(function (pidpid) {
      if (!killed[pidpid]) {
        killPid(pidpid, signal);
        killed[pidpid] = 1;
      }
    });
    if (!killed[pid]) {
      killPid(pid, signal);
      killed[pid] = 1;
    }
  });
}

function killPid(pid, signal) {
  try {
    process.kill(parseInt(pid), signal);
  } catch (err) {
    if (err.code !== 'ESRCH') {
      throw err;
    }
  }
}

function buildProcessTree(ppid, tree, pidsToProcess, cb) {
  var cmd = 'ps -e -o pid,ppid';
  ppid = String(ppid);
  exec(cmd, function (err, stdout, stderr) {
    if (err) {
      console.log(stderr);
      throw err;
    }
    var lines = stdout.toString().split('\n');
    lines = lines.map(function (line) {
      return line.trim().split(/ +/).map(function (item) {
        return item.trim();
      });
    });
    delete pidsToProcess[ppid];

    var pids = [];
    for (var i = 0; i < lines.length; i++) {
      var item = lines[i];
      if (item[1] === ppid) {
        pids.push(parseInt(item[0]));
      }
    }

    if (pids.length === 0 && Object.keys(pidsToProcess).length === 0) {
      return cb();
    }

    pids.forEach(function (pid) {
      tree[ppid].push(pid);
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      buildProcessTree(pid, tree, pidsToProcess, cb);
    });
  });
}
