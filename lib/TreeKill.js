/**
 *
 * Reference: https://github.com/pkrumins/node-tree-kill
 * Author   : pkrumins
 *
 * Update   : PM2 team
 *
 */

var exec = require('child_process').exec,
    isWin = process.platform === 'win32',
    downgradePs = false;

module.exports = function(pid, signal){
  if (isWin) {
    exec('taskkill /pid ' + pid + ' /T /F');
  } else {
    var tree = {}, pidsToProcess = {};
    buildProcessTree(pid, tree, pidsToProcess, function(){
      killAll(tree, signal);
    });
  }
}

function killAll(tree, signal){
  var killed = {};
  Object.keys(tree).forEach(function(pid){
    tree[pid].forEach(function(pidpid){
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

function killPid(pid, signal){
  try {
    process.kill(parseInt(pid, 10), signal);
  }
  catch (err) {
    if (err.code == 'EINVAL'){
      throw new Error('The value of the sig argument is an invalid or unsupported signal number.');
    }
    if(err.code == 'EPERM'){
      throw new Error('The process does not have permission to send the signal to any receiving process.');
    }
    if (err.code !== 'ESRCH'){
      throw err;
    }
  }
}

function buildProcessTree(ppid, tree, pidsToProcess, cb){
  pidsToProcess[ppid] = 1;
  tree[ppid] = [];

  function isFinish(){
    delete pidsToProcess[ppid];
    if(Object.keys(pidsToProcess).length == 0){
      return cb();
    }
  }

  var args = downgradePs ? '-eo pid,ppid | grep -w ' : '-o pid --no-headers --ppid ';
  var ps = exec('ps ' + args + ppid, function(err, stdout, stderr){
    if (err) {
      // illegal option --, try to use basic `ps` instead of it.
      if (/illegal/.test(err.message) && !downgradePs) {
        downgradePs = true;
        return buildProcessTree(ppid, tree, pidsToProcess, cb);
      }

      // Avoid pipe close error - dynamic self-closing process.
      if(/Command failed/.test(err.message)) {
        return isFinish();
      }
      throw err;
    }

    var pids = stdout.split('\n');

    // remove parentPid if necessary.
    downgradePs && pids.shift();

    pids = pids.filter(function(pid){
      return !!pid;
    }).map(function(pid){
      pid = pid.trim();
      return parseInt(downgradePs ? pid.slice(0, pid.search(/\s/)) : pid, 10);
    });

    if(pids.length > 0){
      tree[ppid] = tree[ppid].concat(pids);
      pids.forEach(function(pid){
        if(!tree[pid]) {
          buildProcessTree(pid, tree, pidsToProcess, cb);
        }else{
          delete pidsToProcess[pid];
        }
      });
    }

    isFinish();
  });
}
