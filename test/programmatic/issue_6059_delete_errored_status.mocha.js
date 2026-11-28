/**
 * Issue #6059 — `pm2 delete` overwrites an "errored" process status with
 * "stopped". God.deleteProcessId always goes through God.stopProcessId, and
 * stopProcessId used to force STOPPED_STATUS even when the process had
 * already been marked ERRORED (typically after max_restarts, with no pid).
 * The delete callback then could not tell a crash apart from a clean stop.
 */

process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var God    = require('../../lib/God');
var should = require('should');
var Common = require('../../lib/Common');
var cst    = require('../../constants.js');

process.chdir(__dirname);

// Creates the ~/.pm2 file structure needed by the in-process God.
var pm2 = new PM2.custom();

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

describe('issue #6059 - delete preserves errored status', function() {
  this.timeout(20000);

  var pm_id;
  var child_pid;

  before(function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script        : '../fixtures/echo.js',
      name          : 'delete-errored',
      exec_mode     : 'fork_mode',
      instances     : 1,
      autorestart   : false
    }), function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;
      setTimeout(function() {
        God.clusters_db[pm_id].pm2_env.status.should.eql(cst.ONLINE_STATUS);
        done();
      }, 800);
    });
  });

  after(function(done) {
    if (child_pid && isAlive(child_pid)) {
      try { process.kill(child_pid, 'SIGKILL'); } catch (e) {}
    }
    if (pm_id === undefined || !God.clusters_db[pm_id]) return done();
    God.deleteProcessId(pm_id, function() { done(); });
  });

  it('should keep the errored status in the delete callback', function(done) {
    var proc = God.clusters_db[pm_id];
    child_pid = proc.process.pid;

    // Simulate a process that already reached the errored state (pid gone)
    // without waiting on a full max_restarts crash loop.
    proc.process.pid = 0;
    proc.pm2_env.status = cst.ERRORED_STATUS;

    God.deleteProcessId(pm_id, function(err, deleted) {
      should(err).be.null();
      should(deleted.pm2_env.status).eql(cst.ERRORED_STATUS);
      should(God.clusters_db[pm_id]).be.undefined();
      done();
    });
  });
});
