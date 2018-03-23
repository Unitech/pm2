'use strict';
var pidtree = require('pidtree');

module.exports = function (pid, signal, callback) {
  pidtree(pid, {root: true}, function(err, pids) {
    if (err) {
      console.error('Error while reading process tree', err)
    }

    killAll(pids, signal, callback)
  })
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
