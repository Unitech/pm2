'use strict';

var childProcess = require('child_process');
var exec = childProcess.exec;
var psWarned = false;

module.exports = function (pid, signal, callback) {
  pid = parseInt(pid, 10);
  if (isNaN(pid)) {
    if (callback) return callback(new Error('pid must be a number'));
    return;
  }

  if (process.platform === 'win32') {
    exec('taskkill /pid ' + pid + ' /T /F', { windowsHide: true }, function (err) {
      if (callback) return callback(err, [pid]);
    });
    return;
  }

  // Unix (Linux, macOS, FreeBSD)
  // 1) Snapshot all processes in one ps call
  // 2) Build the descendant tree in JS
  // 3) Kill bottom-up (deepest children first)
  var allData = '';
  var finished = false;
  var ps;

  // A failed spawn (no `ps` binary, e.g. slim Docker images) emits 'error'
  // then 'close': only the first one may conclude (#6171)
  function done(err, pids) {
    if (finished) return;
    finished = true;
    if (callback) return callback(err, pids);
  }

  // Without ps the tree cannot be walked: fall back to killing the root pid
  function noPs(err) {
    if (!psWarned) {
      psWarned = true;
      console.error('[TreeKill] ps unavailable (%s): only the root pid is killed, children may be orphaned', err.code || err.message);
    }
    killPid(pid, signal);
    return done();
  }

  // Bun throws synchronously when the binary is missing, Node emits 'error'
  try {
    ps = childProcess.spawn('ps', ['-e', '-o', 'pid=,ppid=']);
  } catch (err) {
    return noPs(err);
  }

  ps.on('error', noPs);

  if (ps.stdout) {
    ps.stdout.on('data', function (data) {
      allData += data.toString('ascii');
    });
  }

  ps.on('close', function (code) {
    if (finished) return;
    if (code !== 0 && allData.length === 0) {
      killPid(pid, signal);
      return done();
    }

    var childrenMap = {};
    var lines = allData.trim().split('\n');

    lines.forEach(function (line) {
      var parts = line.trim().split(/\s+/);
      if (parts.length < 2) return;
      var cpid = parseInt(parts[0], 10);
      var ppid = parseInt(parts[1], 10);
      if (isNaN(cpid) || isNaN(ppid)) return;
      if (!childrenMap[ppid]) childrenMap[ppid] = [];
      childrenMap[ppid].push(cpid);
    });

    // Collect all descendants depth-first
    var descendants = [];
    function collect(parentPid) {
      var kids = childrenMap[parentPid];
      if (!kids) return;
      kids.forEach(function (kid) {
        collect(kid);
        descendants.push(kid);
      });
    }
    collect(pid);

    // Kill bottom-up: deepest children first, then root
    var allPids = descendants.concat(pid);
    allPids.forEach(function (dpid) {
      killPid(dpid, signal);
    });

    return done(null, allPids);
  });
};

function killPid(pid, signal) {
  try {
    process.kill(parseInt(pid, 10), signal);
  } catch (err) {
    if (err.code !== 'ESRCH')
      console.error(err);
  }
}
