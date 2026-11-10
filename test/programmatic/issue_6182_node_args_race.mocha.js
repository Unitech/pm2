/**
 * Issue #6182 — cluster workers can start with another app's node_args
 * when several apps start concurrently (regression in 7.1.0).
 *
 * God.nodeApp writes the app's node_args into the daemon-wide shared
 * `cluster.settings.execArgv`. Since 7.1.0 `cluster.fork()` runs inside the
 * callback of the asynchronous StdioLogger.open(), so a second app's
 * nodeApp can overwrite `cluster.settings.execArgv` before the first
 * app's fork() runs, and the first worker is spawned with the second
 * app's arguments (e.g. the other app's --env-file).
 *
 * This test calls God.nodeApp for two apps back-to-back in the same tick
 * (exactly what happens on `pm2 start ecosystem.config.js`) and records
 * the execArgv each fork() actually sees. Each worker must be forked
 * with its own app's node_args.
 */

process.env.NODE_ENV = 'test';

var PM2     = require('../..');
var God     = require('../../lib/God');
var should  = require('should');
var Common  = require('../../lib/Common');
var cluster = require('cluster');
var path    = require('path');

process.chdir(__dirname);

// Creates the ~/.pm2 file structure (logs/, pids/, module_conf.json) needed
// by the in-process God on pristine environments like the Docker CI
var pm2 = new PM2.custom();

function makeEnv(name, pm_id, node_args) {
  var conf = Common.prepareAppConf({ cwd: process.cwd() }, {
    script    : '../fixtures/child.js',
    name      : name,
    exec_mode : 'cluster_mode',
    instances : 1,
    node_args : node_args
  });
  conf.pm_id = pm_id;
  // Keep prepareAppConf's real log paths under ~/.pm2/logs/: with real
  // files StdioLogger.open() is asynchronous (createWriteStream 'open'),
  // which is what lets the two nodeApp calls overlap and race. Using
  // /dev/null paths would complete startLogging synchronously and hide
  // the bug.
  return conf;
}

describe('issue #6182 - concurrent cluster starts must not mix node_args', function() {
  this.timeout(20000);

  var original_fork = cluster.fork;
  var original_exec_argv = cluster.settings.execArgv;
  var forked_argv = [];

  before(function() {
    cluster.fork = function(env) {
      forked_argv.push(cluster.settings.execArgv.slice());
      return original_fork.call(cluster, env);
    };
  });

  // The repo's .mocharc sets retries: 2: a failing attempt is re-run, so
  // reset the per-attempt recording before each attempt
  beforeEach(function() {
    forked_argv = [];
  });

  after(function() {
    cluster.fork = original_fork;
    cluster.settings.execArgv = original_exec_argv;
    Object.keys(cluster.workers).forEach(function(k) {
      try { cluster.workers[k].process.kill('SIGKILL'); } catch (e) {}
    });
  });

  it('should fork each worker with its own app node_args', function(done) {
    var env_a = makeEnv('app-a', 0,
      ['--env-file=' + path.join(__dirname, '../fixtures/issue-6182-a.env')]);
    var env_b = makeEnv('app-b', 1,
      ['--env-file=' + path.join(__dirname, '../fixtures/issue-6182-b.env')]);

    var finished = 0;
    function on_started(err) {
      should(err).be.null();
      if (++finished === 2) {
        // One fork must have seen app-a's args, the other app-b's args.
        // Before the fix both forks see app-b's args: nodeApp for app-b
        // overwrote the shared cluster.settings.execArgv while app-a's
        // fork was still waiting on the async StdioLogger.open().
        forked_argv.length.should.eql(2);
        var seen_a = forked_argv.filter(function(argv) {
          return argv.join(' ').indexOf('issue-6182-a.env') !== -1;
        }).length;
        var seen_b = forked_argv.filter(function(argv) {
          return argv.join(' ').indexOf('issue-6182-b.env') !== -1;
        }).length;
        seen_a.should.eql(1, 'expected exactly one worker forked with app-a node_args, forked argv was ' + JSON.stringify(forked_argv));
        seen_b.should.eql(1, 'expected exactly one worker forked with app-b node_args, forked argv was ' + JSON.stringify(forked_argv));
        done();
      }
    }

    // Back-to-back in the same tick: app-b's nodeApp overwrites the shared
    // execArgv before either async StdioLogger.open() callback runs
    God.nodeApp(env_a, on_started);
    God.nodeApp(env_b, on_started);
  });
});
