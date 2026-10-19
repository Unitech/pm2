/**
 * Stale pm2_env._tree_pids (kill-time bookkeeping, 7.0.0-7.0.4 left it on
 * pm2_env, so `pm2 save` / `pm2 update` dumped it and resurrect re-injected it):
 *   - cluster workers got it in process.env (ProcessContainer exports pm2_env)
 *   - processIsDead waited on / SIGKILLed that stale pid list whenever the kill
 *     did not go through treekill (treekill:false, shutdown_with_message...),
 *     hitting whatever unrelated process recycled one of those pids
 */

process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var God    = require('../../lib/God');
var should = require('should');
var fs     = require('fs');
var path   = require('path');
var spawn  = require('child_process').spawn;
var Common = require('../../lib/Common');
var pm2Keys = require('../../lib/tools/pm2-config-keys');

process.chdir(__dirname);

// Creates the PM2_HOME file structure needed by the in-process God
var pm2 = new PM2.custom();

var OUT = path.join(require('os').tmpdir(), 'pm2-tree-pids-' + process.pid + '.json');

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

function readOut() {
  try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { return null; }
}

// Waits for the app (pid != prev_pid) to report its env
function waitOut(prev_pid, cb) {
  var tries = 0;
  (function check() {
    var out = readOut();
    if (out && out.pid !== prev_pid) return cb(out);
    if (++tries > 50) return cb(null);
    setTimeout(check, 100);
  })();
}

function conf(opts) {
  var c = Common.prepareAppConf({ cwd: process.cwd() }, Object.assign({
    script    : '../fixtures/tree-pids-env.js',
    instances : 1,
    env       : { TREE_PIDS_OUT : OUT }
  }, opts));
  return Array.isArray(c) ? c[0] : c;
}

describe('stale pm2_env._tree_pids', function() {
  this.timeout(20000);

  var bystander;
  var pm_id;

  beforeEach(function(done) {
    try { fs.unlinkSync(OUT); } catch (e) {}
    // Unrelated process sitting on a pid listed in the stale _tree_pids
    bystander = spawn('sleep', ['999'], { detached: true, stdio: 'ignore' });
    setTimeout(done, 100);
  });

  afterEach(function(done) {
    if (bystander && isAlive(bystander.pid))
      try { process.kill(bystander.pid, 'SIGKILL'); } catch (e) {}
    try { fs.unlinkSync(OUT); } catch (e) {}
    if (pm_id === undefined || !God.clusters_db[pm_id]) return done();
    God.deleteProcessId(pm_id, function() {
      pm_id = undefined;
      done();
    });
  });

  it('is an internal key: never taken from env or the shell', function() {
    pm2Keys.isPm2InternalKey('_tree_pids').should.be.true();
    pm2Keys.isPm2ConfigKey('_tree_pids').should.be.true();
  });

  it('cluster worker never receives _tree_pids, jlist never shows it', function(done) {
    var c = conf({ name : 'tree-pids-cluster', exec_mode : 'cluster_mode', treekill : true });
    c._tree_pids = [bystander.pid];

    God.prepare(c, function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;

      waitOut(null, function(out1) {
        should(out1).be.ok();
        should(out1.tree_pids).be.null();
        should(God.clusters_db[pm_id].pm2_env._tree_pids).be.undefined();

        God.restartProcessId({ id : pm_id }, function(err) {
          should(err).be.null();
          waitOut(out1.pid, function(out2) {
            should(out2).be.ok();
            should(out2.tree_pids).be.null();
            God.getFormatedProcesses().forEach(function(p) {
              should(p.pm2_env._tree_pids).be.undefined();
            });
            isAlive(bystander.pid).should.be.true();
            done();
          });
        });
      });
    });
  });

  it('stop of an app resurrected with a stale _tree_pids does not kill that pid', function(done) {
    var c = conf({ name : 'tree-pids-resurrect', exec_mode : 'fork_mode', treekill : false, kill_timeout : 500 });
    c._tree_pids = [bystander.pid];

    God.prepare(c, function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;

      waitOut(null, function(out) {
        should(out).be.ok();
        God.stopProcessId(pm_id, function(err) {
          should(err).not.be.ok();
          isAlive(out.pid).should.be.false();
          isAlive(bystander.pid).should.be.true();
          done();
        });
      });
    });
  });

  it('a kill without treekill never reuses a leftover _tree_pids', function(done) {
    var c = conf({ name : 'tree-pids-leftover', exec_mode : 'fork_mode', treekill : false, kill_timeout : 500 });

    God.prepare(c, function(err, procs) {
      should(err).be.null();
      pm_id = procs[0].pm2_env.pm_id;

      waitOut(null, function(out) {
        should(out).be.ok();
        // Left by an earlier kill sequence on the live pm2_env
        God.clusters_db[pm_id].pm2_env._tree_pids = [bystander.pid];
        God.stopProcessId(pm_id, function(err) {
          should(err).not.be.ok();
          isAlive(out.pid).should.be.false();
          isAlive(bystander.pid).should.be.true();
          done();
        });
      });
    });
  });
});
