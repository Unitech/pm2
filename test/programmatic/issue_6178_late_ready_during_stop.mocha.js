/**
 * Issue #6178 - a wait_ready worker that has not sent 'ready' yet is stopped
 * (restart/reload while it is still booting) and its 'ready' arrives while
 * status is STOPPING.
 *
 * readyCb used to set status back to 'online' unconditionally. The following
 * exit was then handled as a crash: handleExit scheduled restart_task
 * (exp_backoff_restart_delay) AND the stop path's restartProcessId ->
 * startProcessId started the worker too. Two workers for one pm_id, one of
 * them orphaned.
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

// restart_task is armed this long after a mis-classified exit, so an orphan
// shows up after the stop path has already started its own worker.
var BACKOFF_MS = 400;

function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return false; }
}

// Calls cb(null, value) once pred() returns something truthy, or an error
// built from describe() after ms.
function waitFor(pred, ms, describe, cb) {
  var start = Date.now();
  (function tick() {
    var v = pred();
    if (v) return cb(null, v);
    if (Date.now() - start > ms)
      return cb(new Error(typeof describe === 'function' ? describe() : describe));
    setTimeout(tick, 25);
  })();
}

// Calls cb with an error as soon as check() returns a message within ms,
// or cb() once ms has passed without one.
function holdFor(check, ms, cb) {
  var start = Date.now();
  (function tick() {
    var bad = check();
    if (bad) return cb(new Error(bad));
    if (Date.now() - start >= ms) return cb();
    setTimeout(tick, 25);
  })();
}

// Every app pid we have seen, in both exec modes. Sampled often enough that
// a worker that is later overwritten in clusters_db is still recorded.
var seenPids = {};
var sampler;

function sample() {
  Object.keys(God.clusters_db).forEach(function(k) {
    var proc = God.clusters_db[k];
    if (proc && proc.process && proc.process.pid) seenPids[proc.process.pid] = true;
  });
  Object.keys(cluster.workers).forEach(function(k) {
    seenPids[cluster.workers[k].process.pid] = true;
  });
}

function alivePids() {
  sample();
  return Object.keys(seenPids).map(Number).filter(isAlive);
}

function findByName(name) {
  var keys = Object.keys(God.clusters_db);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).indexOf('_old_') === 0) continue;
    var proc = God.clusters_db[keys[i]];
    if (proc && proc.pm2_env && proc.pm2_env.name === name) return proc;
  }
  return null;
}

function cleanEverything(done) {
  clearInterval(sampler);
  var keys = Object.keys(God.clusters_db);
  keys.forEach(function(k) {
    var proc = God.clusters_db[k];
    if (!proc || !proc.pm2_env) return;
    clearTimeout(proc.pm2_env.restart_task);
    proc.pm2_env.autorestart = false;
    proc.pm2_env.status = 'stopping';
  });

  var remaining = keys.length;
  var finish = function() {
    setTimeout(function() {
      Object.keys(seenPids).forEach(function(pid) {
        try { process.kill(pid, 'SIGKILL'); } catch (e) {}
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

function appConf(name, env, extra) {
  var conf = {
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
  };
  Object.keys(extra || {}).forEach(function(k) { conf[k] = extra[k]; });
  return Common.prepareAppConf({ cwd : process.cwd() }, conf);
}

function waitOnline(pm_id, notPid, cb) {
  waitFor(function() {
    var proc = God.clusters_db[pm_id];
    return proc && proc.pm2_env.status === 'online' && proc.process.pid !== notPid && proc;
  }, 8000, function() {
    var proc = God.clusters_db[pm_id];
    return 'online timeout status=' + (proc && proc.pm2_env.status) +
      ' pid=' + (proc && proc.process.pid) + ' alive=' + alivePids().join(',');
  }, cb);
}

// For longer than BACKOFF_MS, exactly one app process may be alive and it
// must be the one pm2 tracks.
function assertNoOrphan(pm_id, done) {
  holdFor(function() {
    var proc = God.clusters_db[pm_id];
    var tracked = proc && proc.process.pid;
    var alive = alivePids();
    var old = Object.keys(God.clusters_db).filter(function(k) {
      return String(k).indexOf('_old_') === 0;
    });
    if (!proc || proc.pm2_env.status !== 'online' || alive.length !== 1 ||
        alive[0] !== tracked || old.length !== 0)
      return 'orphan or extra worker: alive=' + alive.join(',') + ' tracked=' + tracked +
        ' status=' + (proc && proc.pm2_env.status) + ' old=' + old.join(',');
  }, BACKOFF_MS * 3, done);
}

/**
 * Starts `name`, catches a worker right after it sent 'booted' (status
 * 'launching', no 'ready' yet) and reloads it, which falls back to a stop
 * plus start. With opts.viaRestart the caught worker is the one a
 * restartProcessId started on an already online app, otherwise it is the
 * very first worker.
 *
 * Then checks that the stopping worker is never put back online, that the
 * replacement comes online, that no orphan is left behind and that the
 * intentional stop did not advance the restart backoff.
 */
function reloadWhileBooting(name, env, opts, done) {
  var conf = appConf(name, env, opts.extra);
  if (conf instanceof Error) return done(conf);

  var restartCbCalls = 0;
  var caught = false;

  function onBoot(packet) {
    if (caught || !packet || packet.raw !== 'booted') return;
    if (!packet.process || packet.process.name !== name) return;
    var proc = findByName(name);
    if (!proc || proc.pm2_env.status !== 'launching') return;
    if (opts.viaRestart && (!opts.firstPid || proc.process.pid === opts.firstPid)) return;
    caught = true;
    God.bus.removeListener('process:msg', onBoot);

    var pm_id = proc.pm2_env.pm_id;
    var stoppedPid = proc.process.pid;
    God.reloadProcessId({ id : pm_id }, function() {});
    if (proc.pm2_env.status !== 'stopping')
      return done(new Error('expected stopping after reload, got ' + proc.pm2_env.status));

    holdFor(function() {
      var cur = God.clusters_db[pm_id];
      if (cur && cur.process.pid === stoppedPid && cur.pm2_env.status === 'online')
        return 'ready during STOPPING flipped status back to online';
    }, opts.holdMs || 0, function(err) {
      if (err) return done(err);
      waitOnline(pm_id, stoppedPid, function(err2, cur) {
        if (err2) return done(err2);
        assertNoOrphan(pm_id, function(err3) {
          if (err3) return done(err3);
          // handleExit used to advance the backoff on an intentional stop.
          (cur.pm2_env.prev_restart_delay || 0).should.eql(0);
          if (opts.viaRestart) restartCbCalls.should.eql(1);
          done();
        });
      });
    });
  }

  God.bus.on('process:msg', onBoot);

  if (!opts.viaRestart) {
    return God.prepare(conf, function(err) {
      if (err && !caught) done(err);
    });
  }

  God.prepare(conf, function(err) {
    if (err) return done(err);
  });
  waitFor(function() {
    var proc = findByName(name);
    return proc && proc.pm2_env.status === 'online' && proc;
  }, 8000, 'start timeout ' + name, function(err, proc) {
    if (err) return done(err);
    opts.firstPid = proc.process.pid;
    // A readyCb that returned early during the stop without calling cb
    // would leave `pm2 restart` hanging.
    God.restartProcessId({ id : proc.pm2_env.pm_id }, function() {
      restartCbCalls++;
    });
  });
}

describe('issue #6178 - ready arriving while a worker is stopping', function() {
  this.timeout(20000);

  beforeEach(function() {
    seenPids = {};
    sampler = setInterval(sample, 20);
  });

  afterEach(cleanEverything);

  it('should not spawn a second worker when ready lands during the stop', function(done) {
    // ready at 800ms, SIGINT held for 2000ms: 'ready' arrives mid-stop.
    reloadWhileBooting('late-ready', { READY_MS : '800', EXIT_MS : '2000' },
      { viaRestart : true, holdMs : 1200 }, done);
  });

  it('should not treat an exit-before-ready during stop as a crash', function(done) {
    // Ready is several seconds out and SIGINT exits in 250ms, so the exit
    // handler calls readyCb. That must not schedule a second start.
    reloadWhileBooting('late-exit', { READY_MS : '4000', EXIT_MS : '250' }, {}, done);
  });

  it('should not spawn a second process in fork mode either', function(done) {
    reloadWhileBooting('late-ready-fork', { READY_MS : '800', EXIT_MS : '2000' },
      { viaRestart : true, holdMs : 1200, extra : { exec_mode : 'fork_mode' } }, done);
  });

  it('should still restart a worker that crashes on its own', function(done) {
    var conf = appConf('late-crash', { READY_MS : '200', EXIT_MS : '500' });
    God.prepare(conf, function(err, procs) {
      if (err) return done(err);
      var pm_id = procs[0].pm2_env.pm_id;
      waitOnline(pm_id, null, function(err2, proc) {
        if (err2) return done(err2);
        var before = proc.pm2_env.restart_time || 0;
        var pid = proc.process.pid;
        proc.send('crash');
        waitOnline(pm_id, pid, function(err3, cur) {
          if (err3) return done(err3);
          cur.pm2_env.restart_time.should.be.above(before);
          assertNoOrphan(pm_id, done);
        });
      });
    });
  });

  it('should end errored, not waiting restart, past max_restarts with a backoff', function(done) {
    // Crashes right away; the backoff bookkeeping used to run after the
    // overlimit check and overwrite 'errored' with 'waiting restart'.
    var conf = appConf('late-overlimit', {}, {
      script                    : '../fixtures/throw.js',
      wait_ready                : false,
      exp_backoff_restart_delay : 50,
      max_restarts              : 2,
      min_uptime                : 5000
    });
    God.prepare(conf, function(err, procs) {
      if (err) return done(err);
      var pm_id = procs[0].pm2_env.pm_id;
      waitFor(function() {
        var proc = God.clusters_db[pm_id];
        return proc && proc.pm2_env.status === 'errored';
      }, 8000, function() {
        var proc = God.clusters_db[pm_id];
        return 'expected errored, got ' + (proc && proc.pm2_env.status);
      }, function(err2) {
        if (err2) return done(err2);
        holdFor(function() {
          var s = God.clusters_db[pm_id].pm2_env.status;
          if (s !== 'errored') return 'status changed to ' + s;
        }, 300, done);
      });
    });
  });

  it('should still reload an online wait_ready worker once', function(done) {
    var conf = appConf('late-reload', { READY_MS : '300', EXIT_MS : '400' });
    God.prepare(conf, function(err, procs) {
      if (err) return done(err);
      var pm_id = procs[0].pm2_env.pm_id;
      waitOnline(pm_id, null, function(err2, proc) {
        if (err2) return done(err2);
        var oldPid = proc.process.pid;
        God.reloadProcessId({ id : pm_id }, function() {});
        waitOnline(pm_id, oldPid, function(err3) {
          if (err3) return done(err3);
          // The parked worker exits EXIT_MS after the replacement is ready.
          waitFor(function() {
            return !God.clusters_db['_old_' + pm_id] && !isAlive(oldPid);
          }, 8000, 'old worker still around after reload', function(err4) {
            if (err4) return done(err4);
            assertNoOrphan(pm_id, done);
          });
        });
      });
    });
  });
});
