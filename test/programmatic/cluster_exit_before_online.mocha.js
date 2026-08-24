/**
 * A cluster worker that dies BEFORE emitting 'online' (invalid execArgv, OOM
 * at boot, EMFILE…) used to leave executeApp's callback unfired: the
 * start/restart RPC never got an answer and the CLI hung forever.
 * executeApp must now conclude on exit-before-online (like the Bun branch
 * already did) and report the app instead of hanging.
 */

process.env.NODE_ENV = 'test';

var God     = require('../../lib/God');
var should  = require('should');
var Common  = require('../../lib/Common');
var cluster = require('cluster');

process.chdir(__dirname);

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

describe('cluster worker dying before online must not hang the caller', function() {
  this.timeout(30000);

  afterEach(cleanEverything);

  it('should fire the restart callback even when the new worker cannot boot', function(done) {
    God.prepare(Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/echo.js',
      name      : 'restart-no-hang',
      exec_mode : 'cluster_mode',
      instances : 1
    }), function(err, procs) {
      should(err).be.null();
      var pm_id = procs[0].pm2_env.pm_id;

      setTimeout(function() {
        var proc = God.clusters_db[pm_id];
        proc.pm2_env.status.should.eql('online');

        // the replacement will die before 'online'
        proc.pm2_env.node_args   = ['--bogus-invalid-flag'];
        proc.pm2_env.min_uptime  = 100;
        proc.pm2_env.max_restarts = 2;

        var start = Date.now();
        God.restartProcessId({ id : pm_id }, function(err2) {
          // the RPC answer is what matters: it must come back promptly
          (Date.now() - start).should.be.below(5000,
            'restart callback took too long (was hanging before the fix)');
          done();
        });
      }, 800);
    });
  });

  it('should fire the prepare callback even when the app cannot boot at all', function(done) {
    var conf = Common.prepareAppConf({ cwd: process.cwd() }, {
      script    : '../fixtures/echo.js',
      name      : 'start-no-hang',
      exec_mode : 'cluster_mode',
      instances : 1,
      node_args : ['--bogus-invalid-flag'],
      min_uptime   : 100,
      max_restarts : 2
    });

    var start = Date.now();
    God.prepare(conf, function(err, procs) {
      (Date.now() - start).should.be.below(5000,
        'prepare callback took too long (was hanging before the fix)');
      done();
    });
  });
});
