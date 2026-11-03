/**
 * Issue #6178 - a cluster worker that has not sent 'ready' yet is stopped
 * (restart/reload while it is still booting) and its 'ready' arrives while
 * status is STOPPING.
 *
 * readyCb used to set status back to 'online' unconditionally. The following
 * exit was then handled as a crash: handleExit scheduled restart_task
 * (exp_backoff_restart_delay) AND the stop path's restartProcessId ->
 * startProcessId started the worker too. Two workers for one pm_id, one of
 * them orphaned (not the clusters_db occupant, still in the round robin).
 */

process.env.NODE_ENV = 'test';

var PM2     = require('../..');
var God     = require('../../lib/God');
var should  = require('should');
var Common  = require('../../lib/Common');
var cluster = require('cluster');

process.chdir(__dirname);

// Creates the ~/.pm2 file structure (logs/, pids/, module_conf.json) needed
// by the in-process God on pristine environments like the Docker CI
var pm2 = new PM2.custom();

var APP = '../fixtures/issue-6178-late-ready.js';

// restart_task is armed this long after the mis-classified exit, so the
// orphan shows up after the stop path has already started its own worker.
var BACKOFF_MS = 400;

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function findByName(name) {
  var keys = Object.keys(God.clusters_db);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).indexOf('_old_') === 0) continue;
    var proc = God.clusters_db[keys[i]];
    if (proc && proc.pm2_env && proc.pm2_env.name === name)
      return proc;
  }
  return null;
}

function workerPids() {
  return Object.keys(cluster.workers).map(function(k) {
    return cluster.workers[k].process.pid;
  });
}

function cleanEverything(done) {
  Object.keys(God.clusters_db).forEach(function(k) {
    var proc = God.clusters_db[k];
    if (!proc || !proc.pm2_env) return;
    clearTimeout(proc.pm2_env.restart_task);
    proc.pm2_env.autorestart = false;
    proc.pm2_env.status = 'stopping';
  });

  Object.keys(cluster.workers).forEach(function(k) {
    try { cluster.workers[k].process.kill('SIGKILL'); } catch (e) {}
  });

  var keys = Object.keys(God.clusters_db);
  var remaining = keys.length;

  var finish = function() {
    setTimeout(function() {
      Object.keys(cluster.workers).forEach(function(k) {
        try { cluster.workers[k].process.kill('SIGKILL'); } catch (e) {}
      });
      Object.keys(God.clusters_db).forEach(function(k) {
        var proc = God.clusters_db[k];
        if (proc && proc.pm2_env) clearTimeout(proc.pm2_env.restart_task);
        delete God.clusters_db[k];
      });
      done();
    }, 200);
  };

  if (!remaining) return finish();
  keys.forEach(function(k) {
    God.deleteProcessId(k, function() {
      if (--remaining === 0) finish();
    });
  });
}

function appConf(name, env) {
  return Common.prepareAppConf({ cwd : process.cwd() }, {
    script                     : APP,
    name                       : name,
    exec_mode                  : 'cluster_mode',
    instances                  : 1,
    wait_ready                 : true,
    listen_timeout             : 10000,
    kill_timeout               : 8000,
    exp_backoff_restart_delay  : BACKOFF_MS,
    vizion                     : false,
    autorestart                : true,
    // executeApp only reports 'launching' when autostart is set. That is the
    // status a booting wait_ready worker has, and the one reload/restart
    // treats as stoppable.
    autostart                  : true,
    env                        : env || {}
  });
}

function startOnline(name, env, cb) {
  var conf = appConf(name, env);
  if (conf instanceof Error) return cb(conf);

  var done = false;
  var start = Date.now();
  var iv;

  function finish(err, pm_id) {
    if (done) return;
    done = true;
    clearInterval(iv);
    cb(err, pm_id);
  }

  God.prepare(conf, function(err) {
    if (err) finish(err);
  });

  iv = setInterval(function() {
    var proc = findByName(name);
    if (proc && proc.pm2_env.status === 'online')
      return finish(null, proc.pm2_env.pm_id);
    if (Date.now() - start > 8000)
      finish(new Error('start timeout name=' + name +
        ' status=' + (proc && proc.pm2_env.status) +
        ' state=' + (proc && proc.state)));
  }, 30);
}

// Next 'booted' for this pm_id whose pid is not `notPid` (the worker that
// is being replaced). Registered before the restart so the message is not
// missed.
function waitForBoot(pm_id, notPid, cb) {
  var done = false;
  function finish(err, proc) {
    if (done) return;
    done = true;
    God.bus.removeListener('process:msg', onMsg);
    clearTimeout(timer);
    cb(err, proc);
  }
  function onMsg(packet) {
    if (!packet || packet.raw !== 'booted') return;
    if (!packet.process || packet.process.pm_id !== pm_id) return;
    var proc = God.clusters_db[pm_id];
    if (!proc || proc.process.pid === notPid) return;
    if (proc.pm2_env.status !== 'launching') return;
    finish(null, proc);
  }
  var timer = setTimeout(function() {
    var proc = God.clusters_db[pm_id];
    finish(new Error('no booted message status=' + (proc && proc.pm2_env.status) +
      ' pid=' + (proc && proc.process.pid)));
  }, 8000);
  God.bus.on('process:msg', onMsg);
}

// For `ms`, the worker `pid` must not be put back to online.
function assertStaysStopping(pm_id, pid, ms, cb) {
  var flipped = false;
  var start = Date.now();
  var iv = setInterval(function() {
    var proc = God.clusters_db[pm_id];
    if (proc && proc.process.pid === pid && proc.pm2_env.status === 'online')
      flipped = true;
    if (Date.now() - start >= ms) {
      clearInterval(iv);
      cb(flipped ? new Error('ready during STOPPING flipped status back to online') : null);
    }
  }, 20);
}

function waitOnline(pm_id, notPid, cb) {
  var start = Date.now();
  var iv = setInterval(function() {
    var proc = God.clusters_db[pm_id];
    if (proc && proc.pm2_env.status === 'online' && proc.process.pid !== notPid) {
      clearInterval(iv);
      return cb(null, proc);
    }
    if (Date.now() - start > 8000) {
      clearInterval(iv);
      cb(new Error('online timeout status=' + (proc && proc.pm2_env.status) +
        ' pid=' + (proc && proc.process.pid) +
        ' workers=' + workerPids().join(',')));
    }
  }, 30);
}

// For longer than BACKOFF_MS after the replacement is online, exactly one
// cluster worker may exist and it must be the one pm2 tracks.
function assertNoOrphan(pm_id, done) {
  var ticks = 0;
  var bad = null;
  var iv = setInterval(function() {
    var proc = God.clusters_db[pm_id];
    var pids = workerPids();
    var tracked = proc && proc.process.pid;
    var oldKeys = Object.keys(God.clusters_db).filter(function(k) {
      return String(k).indexOf('_old_') === 0;
    });

    if (!proc || proc.pm2_env.status !== 'online' ||
        pids.length !== 1 || pids[0] !== tracked ||
        !isAlive(tracked) || oldKeys.length !== 0) {
      bad = 'workers=' + pids.join(',') +
        ' tracked=' + tracked +
        ' status=' + (proc && proc.pm2_env.status) +
        ' old=' + oldKeys.join(',');
    }

    if (++ticks >= 30) { // 30 * 40ms = 1200ms > BACKOFF_MS
      clearInterval(iv);
      if (bad) return done(new Error('orphan or extra worker: ' + bad));
      done();
    }
  }, 40);
}

describe('issue #6178 - ready arriving while a cluster worker is stopping', function() {
  this.timeout(20000);

  afterEach(cleanEverything);

  it('should not spawn a second worker when ready lands during the stop', function(done) {
    // ready at 800ms, SIGINT held for 2000ms: reload right after boot, and
    // 'ready' arrives while the stop is still in progress.
    var env = { READY_MS : '800', EXIT_MS : '2000' };

    startOnline('late-ready', env, function(err, pm_id) {
      if (err) return done(err);

      var firstPid = God.clusters_db[pm_id].process.pid;

      waitForBoot(pm_id, firstPid, function(err2, booting) {
        if (err2) return done(err2);

        var bootingPid = booting.process.pid;
        // Not online yet, so reload falls back to restart and stops it.
        God.reloadProcessId({ id : pm_id }, function() {});
        var status = God.clusters_db[pm_id].pm2_env.status;
        if (status !== 'stopping')
          return done(new Error('expected stopping after reload, got ' + status));

        assertStaysStopping(pm_id, bootingPid, 1200, function(err3) {
          if (err3) return done(err3);

          waitOnline(pm_id, bootingPid, function(err4) {
            if (err4) return done(err4);
            assertNoOrphan(pm_id, done);
          });
        });
      });

      God.restartProcessId({ id : pm_id }, function() {});
    });
  });

  it('should not treat an exit-before-ready during stop as a crash', function(done) {
    // Ready is several seconds out; SIGINT exits in 250ms. Stopping the
    // worker while it is still launching makes the exit handler call
    // readyCb (the start callback has not run yet). That must not schedule
    // a second start on top of the stop path's own restart.
    var env = { READY_MS : '4000', EXIT_MS : '250' };
    var conf = appConf('late-exit', env);
    if (conf instanceof Error) return done(conf);

    var caught = false;
    function onBoot(packet) {
      if (caught || !packet || packet.raw !== 'booted') return;
      if (!packet.process || packet.process.name !== 'late-exit') return;
      var proc = findByName('late-exit');
      if (!proc || proc.pm2_env.status !== 'launching') return;
      caught = true;
      God.bus.removeListener('process:msg', onBoot);

      var pm_id = proc.pm2_env.pm_id;
      var stoppedPid = proc.process.pid;
      God.reloadProcessId({ id : pm_id }, function() {});
      if (God.clusters_db[pm_id].pm2_env.status !== 'stopping')
        return done(new Error('expected stopping, got ' +
          God.clusters_db[pm_id].pm2_env.status));

      waitOnline(pm_id, stoppedPid, function(err2) {
        if (err2) return done(err2);
        assertNoOrphan(pm_id, done);
      });
    }

    God.bus.on('process:msg', onBoot);
    God.prepare(conf, function(err) {
      if (err && !caught) done(err);
    });
  });

  it('should still restart a worker that crashes on its own', function(done) {
    var env = { READY_MS : '200', EXIT_MS : '500' };

    startOnline('late-crash', env, function(err, pm_id) {
      if (err) return done(err);

      var before = God.clusters_db[pm_id].pm2_env.restart_time || 0;
      var pid = God.clusters_db[pm_id].process.pid;
      try { God.clusters_db[pm_id].send('crash'); }
      catch (e) { return done(e); }

      waitOnline(pm_id, pid, function(err2, proc) {
        if (err2) return done(err2);
        proc.pm2_env.restart_time.should.be.above(before);
        assertNoOrphan(pm_id, done);
      });
    });
  });

  it('should still reload an online wait_ready worker once', function(done) {
    var env = { READY_MS : '300', EXIT_MS : '400' };

    startOnline('late-reload', env, function(err, pm_id) {
      if (err) return done(err);

      var oldPid = God.clusters_db[pm_id].process.pid;
      God.reloadProcessId({ id : pm_id }, function() {});

      waitOnline(pm_id, oldPid, function(err2) {
        if (err2) return done(err2);

        // The parked worker exits EXIT_MS after the reload asks it to stop,
        // which is once the replacement is ready. Give that a moment.
        var start = Date.now();
        var iv = setInterval(function() {
          var old = God.clusters_db['_old_' + pm_id];
          var pids = workerPids();
          if (!old && pids.length === 1 && !isAlive(oldPid)) {
            clearInterval(iv);
            return assertNoOrphan(pm_id, done);
          }
          if (Date.now() - start > 8000) {
            clearInterval(iv);
            done(new Error('reload left workers=' + pids.join(',') +
              ' old=' + !!old + ' oldPidAlive=' + isAlive(oldPid)));
          }
        }, 30);
      });
    });
  });
});
