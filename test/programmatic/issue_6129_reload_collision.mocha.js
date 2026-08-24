/**
 * Issue #6129 — overlapping reloads of the same cluster app collide on the
 * single `_old_<pm_id>` registry slot.
 *
 * Reload.js parks the outgoing worker under `'_old_' + pm_id` without checking
 * whether that slot is already occupied by a previous, still-pending reload.
 * When a second reload starts while the first one is still waiting for its new
 * worker to emit 'listening' (or 'ready'), the second reload overwrites the
 * slot: the first parked worker loses its registry entry without ever being
 * stopped. It stays in Node's cluster.workers, keeps receiving round-robin
 * traffic with stale code, and is invisible to pm2 list / delete.
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

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

// Delete every God process properly (cancels pending restart_task so nothing
// respawns), then SIGKILL any orphan the tested bug may have left behind
function cleanEverything(done) {
  var keys = Object.keys(God.clusters_db);
  var remaining = keys.length;

  var finish = function() {
    Object.keys(cluster.workers).forEach(function(k) {
      try { cluster.workers[k].process.kill('SIGKILL'); } catch (e) {}
    });
    setTimeout(done, 300);
  };

  if (!remaining) return finish();
  keys.forEach(function(k) {
    God.deleteProcessId(k, function() {
      if (--remaining === 0) finish();
    });
  });
}

describe('issue #6129 - overlapping reloads on the same cluster app', function() {
  this.timeout(40000);

  var pm_id;
  var first_pid;

  before(function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/issue-6129-slow-listen.js',
      name      : 'slow-listen',
      exec_mode : 'cluster_mode',
      instances : 1
    }), function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;

      setTimeout(function() {
        God.clusters_db[pm_id].pm2_env.status.should.eql('online');
        first_pid = God.clusters_db[pm_id].process.pid;
        done();
      }, 1000);
    });
  });

  after(cleanEverything);

  it('should not orphan a worker when a second reload overlaps the first', function(done) {
    var results = [];

    // First reload: parks worker A under `_old_<pm_id>`, spawns worker B,
    // then waits for B to emit 'listening' (the fixture binds after 2s)
    God.reloadProcessId({ id : pm_id }, function(err) {
      results.push(err || null);
    });

    // Second reload 700ms later: B is already status=online (cluster 'online'
    // event) but has not emitted 'listening' yet, so the first reload is still
    // pending — B gets parked under the SAME `_old_<pm_id>` key, clobbering A
    setTimeout(function() {
      God.reloadProcessId({ id : pm_id }, function(err) {
        results.push(err || null);
      });
    }, 700);

    // Let both reloads and their cleanups fully settle
    setTimeout(function() {
      // 1. exactly one worker of this app must be alive in the cluster
      Object.keys(cluster.workers).length.should.eql(1,
        'expected 1 live cluster worker, found ' +
        Object.keys(cluster.workers).length + ' (orphaned worker left behind)');

      // 2. the first generation worker must be dead
      isAlive(first_pid).should.eql(false,
        'first worker (pid ' + first_pid +
        ') is still alive: orphan serving stale code');

      // 3. no worker may stay parked under a _old_ key
      Object.keys(God.clusters_db).filter(function(k) {
        return String(k).indexOf('_old_') === 0;
      }).should.eql([]);

      // 4. both reload callbacks must have completed (results are in
      // completion order); one reload may be legitimately refused while the
      // other is pending, but nothing may fail with anything else (like the
      // `_old_N : id unknown` double-stop error)
      results.length.should.eql(2);
      var refused = results.filter(function(e) { return e !== null; });
      refused.length.should.be.belowOrEqual(1);
      refused.forEach(function(e) {
        e.message.should.match(/already in progress/i);
      });

      done();
    }, 10000);
  });
});

describe('issue #6129 - reload must not wedge when the replacement cannot boot', function() {
  this.timeout(30000);

  var pm_id;

  before(function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/echo.js',
      name      : 'wedge-test',
      exec_mode : 'cluster_mode',
      instances : 1
    }), function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;
      setTimeout(done, 800);
    });
  });

  after(cleanEverything);

  it('should release the _old_ slot even when the new worker dies before online', function(done) {
    var proc = God.clusters_db[pm_id];

    // The replacement will die before emitting 'online': executeApp's
    // callback never fires, only the backstop timer can conclude the reload
    proc.pm2_env.listen_timeout = 1500;
    proc.pm2_env.node_args = ['--bogus-invalid-flag'];
    proc.pm2_env.min_uptime = 100;
    proc.pm2_env.max_restarts = 2;

    var cb_fired = false;
    God.reloadProcessId({ id : pm_id }, function() {
      cb_fired = true;
    });

    setTimeout(function() {
      // the reload must have concluded (no hung RPC)
      cb_fired.should.eql(true, 'reload callback never fired (wedged)');

      // and the _old_ slot must have been released
      Object.keys(God.clusters_db).filter(function(k) {
        return String(k).indexOf('_old_') === 0;
      }).should.eql([]);

      // once the user fixes their config, reload must be possible again
      God.clusters_db[pm_id].pm2_env.node_args = [];
      God.reloadProcessId({ id : pm_id }, function(err) {
        if (err)
          err.message.should.not.match(/already in progress/i);
        done();
      });
    }, 5000);
  });
});

describe('issue #6129 - soft reload must not wedge when backstop beats the new worker', function() {
  this.timeout(30000);

  var pm_id;

  before(function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/issue-6129-slow-listen.js',
      name      : 'soft-wedge-test',
      exec_mode : 'cluster_mode',
      instances : 1
    }), function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;
      setTimeout(done, 1000);
    });
  });

  after(cleanEverything);

  it('should conclude via the graceful timer despite a late listening event', function(done) {
    var proc = God.clusters_db[pm_id];

    // Backstop (10ms) fires long before the new worker is online; the app
    // has no 'shutdown' handler and binds its port after 2s, so the late
    // 'listening' event must not cancel the graceful shutdown timer
    proc.pm2_env.listen_timeout = 10;

    var cb_fired = false;
    God.softReloadProcessId({ id : pm_id }, function() {
      cb_fired = true;
    });

    // graceful timeout is 8s: everything must have concluded by 12s
    setTimeout(function() {
      cb_fired.should.eql(true, 'soft reload callback never fired (wedged)');

      Object.keys(God.clusters_db).filter(function(k) {
        return String(k).indexOf('_old_') === 0;
      }).should.eql([]);

      Object.keys(cluster.workers).length.should.eql(1,
        'expected 1 live cluster worker after soft reload');

      done();
    }, 12000);
  });
});
