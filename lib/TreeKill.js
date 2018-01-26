'use strict';

// From https://raw.githubusercontent.com/pkrumins/node-tree-kill/master/index.js

var childProcess = require('child_process');
var spawn = childProcess.spawn;
var exec = childProcess.exec;

module.exports = function (pid, signal, callback) {
  var tree = {};
  var pidsToProcess = {};
  tree[pid] = [];
  pidsToProcess[pid] = 1;

  switch (process.platform) {
  case 'win32':
    exec('taskkill /pid ' + pid + ' /T /F', { windowsHide: true }, callback);
    break;
  case 'darwin':
    buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
      return spawn('pgrep', ['-P', parentPid]);
    }, function () {
      killAll(tree, signal, callback);
    });
    break;
    // case 'sunos':
    //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
    //         killAll(tree, signal, callback);
    //     });
    //     break;
  default: // Linux
    buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
      return spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid]);
    }, function () {
      killAll(tree, signal, callback);
    });
    break;
  }
};

function killAll (tree, signal, callback) {
  var killed = {};
  try {
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
  } catch (err) {
    if (callback) {
      return callback(err);
    } else {
      console.error(err);
    }
  }
  if (callback) {
    return callback();
  }
}

function killPid(pid, signal) {
  try {
    process.kill(parseInt(pid, 10), signal);
  }
  catch (err) {
    if (err.code !== 'ESRCH')
      console.error(err);
  }
}

function buildProcessTree (parentPid, tree, pidsToProcess, spawnChildProcessesList, cb) {
  var ps = spawnChildProcessesList(parentPid);
  var allData = '';

  ps.on('error', function(err) {
    console.error(err);
  });

  if (ps.stdout) {
    ps.stdout.on('data', function (data) {
      data = data.toString('ascii');
      allData += data;
    });
  }

  var onClose = function (code) {
    delete pidsToProcess[parentPid];

    if (code !== 0) {
      // no more parent processes
      if (Object.keys(pidsToProcess).length == 0) {
        cb();
      }
      return;
    }
    var pids = allData.match(/\d+/g) || [];
    if (pids.length === 0)
      return cb();

    pids.forEach(function (pid) {
      pid = parseInt(pid, 10);
      tree[parentPid].push(pid);
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
    });
  };

  ps.on('close', onClose);
}
