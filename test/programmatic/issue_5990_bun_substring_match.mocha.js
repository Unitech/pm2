/**
 * Regression test for #5990
 *
 * The "bun" interpreter detection used a naive substring match
 * (interpreter.includes('bun')), which matched any path containing the
 * letters "bun" — most notably the Ubuntu home directory ("/home/ubuntu/...").
 *
 * That caused PM2 to launch Python (or any non-bun interpreter located under
 * /home/ubuntu) with ProcessContainerForkBun.js as the script, which Python
 * then tried to parse as Python source — producing "SyntaxError: unterminated
 * string literal" on the apostrophe in "user's application" at line 29.
 *
 * The fix is to anchor the match to the end of the interpreter path
 * (basename === 'bun' or path ends with 'bun').
 */

process.chdir(__dirname);

var should = require('should');
var Common = require('../../lib/Common');

describe('Bun interpreter detection (#5990)', function () {

  describe('Common.sink.determineExecMode', function () {
    function exec_mode_for(interpreter, instances) {
      var app = { exec_interpreter: interpreter };
      if (instances !== undefined) app.instances = instances;
      Common.sink.determineExecMode(app);
      return app.exec_mode;
    }

    it('should not pick cluster_mode for python under /home/ubuntu (substring "bun")', function () {
      should(exec_mode_for('/home/ubuntu/.venvs/bin/python', 1)).eql('fork_mode');
      should(exec_mode_for('/home/ubuntu/jesse-bot/bin/python', 1)).eql('fork_mode');
      should(exec_mode_for('/home/ubuntu/.venvs/bin/python3.11-orig', 1)).eql('fork_mode');
    });

    it('should not pick cluster_mode for arbitrary non-node/bun interpreters', function () {
      should(exec_mode_for('/usr/bin/python3.11', 1)).eql('fork_mode');
      should(exec_mode_for('/usr/local/bin/ruby', 1)).eql('fork_mode');
      should(exec_mode_for('/usr/bin/php', 1)).eql('fork_mode');
    });

    it('should still pick cluster_mode for genuine node interpreter', function () {
      should(exec_mode_for('/usr/bin/node', 1)).eql('cluster_mode');
      should(exec_mode_for('node', 1)).eql('cluster_mode');
    });

    it('should still pick cluster_mode for genuine bun interpreter', function () {
      should(exec_mode_for('/usr/local/bin/bun', 1)).eql('cluster_mode');
      should(exec_mode_for('bun', 1)).eql('cluster_mode');
      should(exec_mode_for('/home/ubuntu/.bun/bin/bun', 1)).eql('cluster_mode');
    });
  });

  describe('God.forkMode interpreter routing', function () {
    /**
     * We don't actually spawn — we only need to verify which container script
     * the fork-mode dispatcher selects. Stub child_process.spawn to capture
     * the (command, args) pair, then call God.forkMode.
     */
    var path = require('path');
    var child_process = require('child_process');
    var realSpawn;
    var capturedArgs;

    before(function () {
      realSpawn = child_process.spawn;
      child_process.spawn = function (command, args) {
        capturedArgs = { command: command, args: args };
        // Return a stub that satisfies the immediate checks in ForkMode and
        // makes the spawned "process" look failed (no IPC channel) so the
        // fork-mode flow exits cleanly without scheduling timers.
        var EventEmitter = require('events').EventEmitter;
        var stub = new EventEmitter();
        stub.stdout = new EventEmitter();
        stub.stderr = new EventEmitter();
        stub.pid = 0;
        stub.kill = function () {};
        stub.unref = function () {};
        stub.disconnect = function () {};
        return stub;
      };
    });

    after(function () {
      child_process.spawn = realSpawn;
    });

    function fork_container_for(interpreter, done) {
      var God = { bus: { emit: function () {} }, clusters_db: {} };
      require('../../lib/God/ForkMode.js')(God);

      var pm2_env = {
        name: 'test',
        pm_id: 0,
        exec_interpreter: interpreter,
        pm_exec_path: '/tmp/dummy_app.js',
        pm_pid_path: '/tmp/dummy.pid',
        pm_out_log_path: '/dev/null',
        pm_err_log_path: '/dev/null',
        env: {}
      };

      capturedArgs = null;
      God.forkMode(pm2_env, function () {
        // ignore — we only care about what was passed to spawn
      });

      // spawn is called synchronously after Utility.startLogging opens log
      // file descriptors; give the fs callbacks a tick to fire.
      setTimeout(function () {
        done(capturedArgs);
      }, 50);
    }

    it('should NOT route python under /home/ubuntu through ProcessContainerForkBun.js', function (done) {
      fork_container_for('/home/ubuntu/.venvs/bin/python', function (captured) {
        should.exist(captured);
        captured.command.should.eql('/home/ubuntu/.venvs/bin/python');
        var script = captured.args[captured.args.length - 1];
        script.should.not.match(/ProcessContainerForkBun\.js$/);
        script.should.not.match(/ProcessContainerFork\.js$/);
        script.should.eql('/tmp/dummy_app.js');
        done();
      });
    });

    it('should route a genuine bun interpreter through ProcessContainerForkBun.js', function (done) {
      fork_container_for('/usr/local/bin/bun', function (captured) {
        should.exist(captured);
        var script = captured.args[captured.args.length - 1];
        script.should.match(/ProcessContainerForkBun\.js$/);
        done();
      });
    });
  });
});
