/**
 * An app stopped while still waiting for its 'ready' message (wait_ready)
 * must stay stopped.
 *
 * The exit-before-ready path used to conclude executeApp through readyCb(),
 * which overwrote the 'stopping' status with 'online': handleExit() then
 * took the stop for a crash and restarted the app.
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

describe('stopping an app before it sent ready', function() {
  this.timeout(30000);

  afterEach(cleanEverything);

  ['cluster_mode', 'fork_mode'].forEach(function(exec_mode) {
    it('should keep it stopped (' + exec_mode + ')', function(done) {
      // echo.js never sends 'ready'
      God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
        script         : '../fixtures/echo.js',
        name           : 'stop-before-ready-' + exec_mode,
        exec_mode      : exec_mode,
        instances      : 1,
        autostart      : true,
        wait_ready     : true,
        listen_timeout : 3000
      }), function() {});

      setTimeout(function() {
        var pm_id = Object.keys(God.clusters_db)[0];
        God.clusters_db[pm_id].pm2_env.status.should.eql('launching');

        God.stopProcessId(pm_id, function(err) {
          should(err).be.null();

          // past listen_timeout, so a leftover ready timer would have fired too
          setTimeout(function() {
            var proc = God.clusters_db[pm_id];
            proc.pm2_env.status.should.eql('stopped');
            proc.pm2_env.restart_time.should.eql(0,
              'the stopped app was restarted');
            proc.process.pid.should.eql(0);
            done();
          }, 4000);
        });
      }, 1000);
    });
  });
});
