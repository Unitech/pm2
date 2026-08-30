/**
 * Issue #6142 — a late 'exit' event from a previous process generation is
 * misattributed to its replacement.
 *
 * God.handleExit() looks the process up by pm_id only
 * (`God.clusters_db[clu.pm2_env.pm_id]`) and never checks that the exiting
 * child is still the current occupant of that slot. On Windows with
 * `shutdown_with_message`, the old child's 'exit' event is delivered after the
 * replacement already occupies the same pm_id: PM2 then treats the stale exit
 * as a crash of the replacement and schedules ANOTHER start — two processes
 * compete for the same port (EADDRINUSE).
 *
 * This test reproduces the misattribution directly: it captures the
 * generation-1 process object, restarts the app, then delivers gen-1's exit
 * event the way the platform would deliver it late.
 */

process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var God    = require('../../lib/God');
var should = require('should');
var Common = require('../../lib/Common');

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

describe('issue #6142 - stale exit event from a previous generation', function() {
  this.timeout(20000);

  var pm_id;
  var gen1;

  before(function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/echo.js',
      name      : 'stale-exit',
      exec_mode : 'fork_mode',
      instances : 1
    }), function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;

      setTimeout(function() {
        gen1 = God.clusters_db[pm_id];
        gen1.pm2_env.status.should.eql('online');
        done();
      }, 800);
    });
  });

  after(function(done) {
    if (pm_id === undefined) return done();
    var db_pid = God.clusters_db[pm_id] && God.clusters_db[pm_id].process.pid;
    God.deleteProcessId(pm_id, function() {
      // also reap any duplicate the bug may have spawned
      [gen1 && gen1.process.pid, db_pid].forEach(function(pid) {
        if (pid && isAlive(pid)) {
          try { process.kill(pid, 'SIGKILL'); } catch (e) {}
        }
      });
      setTimeout(done, 200);
    });
  });

  it('should ignore an exit event that belongs to a replaced process', function(done) {
    God.restartProcessId({ id : pm_id }, function(err) {
      should(err).be.null();

      setTimeout(function() {
        var gen2 = God.clusters_db[pm_id];
        var gen2_pid = gen2.process.pid;

        gen2.pm2_env.status.should.eql('online');
        gen2_pid.should.not.eql(gen1.process.pid);

        var restarts_before = gen2.pm2_env.restart_time;

        // Deliver the OLD child's exit event now, after the replacement
        // already occupies the pm_id slot (what Windows does with
        // shutdown_with_message)
        God.handleExit(gen1, 0, 'SIGINT');

        setTimeout(function() {
          var current = God.clusters_db[pm_id];

          // the stale exit must not have touched the replacement
          current.pm2_env.status.should.eql('online');
          current.pm2_env.restart_time.should.eql(restarts_before,
            'stale exit event scheduled an extra restart');
          current.process.pid.should.eql(gen2_pid,
            'replacement was restarted because of a stale exit event');

          // and no duplicate process may be running
          var alive = [gen2_pid, current.process.pid].filter(function(pid, i, arr) {
            return arr.indexOf(pid) === i && isAlive(pid);
          });
          alive.length.should.eql(1,
            'two processes of the same app are running: ' + alive.join(', '));

          done();
        }, 1200);
      }, 800);
    });
  });
});
