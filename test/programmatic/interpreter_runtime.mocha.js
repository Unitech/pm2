/**
 * Node.js / Bun interpreter detection with atypical basenames.
 *
 * Cluster mode is only possible with a Node.js/Bun interpreter, so an explicit
 * `exec_mode: cluster` on a non-JS interpreter falls back to fork (#4775).
 * That guard must not demote a genuine Node.js runtime whose binary is not
 * literally named `node`: `node.exe` / `node64.exe` on Windows (nvm-windows),
 * `nodejs` (Debian), versioned binaries (`node18`, `node-v20`) or `node@18`.
 */

process.chdir(__dirname);

var should = require('should');
var Common = require('../../lib/Common');
var runtimeOf = require('../../lib/tools/interpreter.js').runtimeOf;

describe('Interpreter runtime detection', function () {

  describe('runtimeOf', function () {
    it('should recognize Node.js under its usual names', function () {
      ['node', '/usr/bin/node', '/usr/local/n/versions/node/20.1.0/bin/node',
       'nodejs', '/usr/bin/nodejs'].forEach(function (i) {
        should(runtimeOf(i)).eql('node', i);
      });
    });

    it('should recognize Windows executables and nvm-windows layouts', function () {
      ['node.exe', 'NODE.EXE', 'node64.exe', 'node.cmd',
       'C:\\Program Files\\nodejs\\node.exe',
       'C:\\Users\\me\\AppData\\Roaming\\nvm\\v18.0.0\\node64.exe'].forEach(function (i) {
        should(runtimeOf(i)).eql('node', i);
      });
    });

    it('should recognize versioned Node.js binaries', function () {
      ['node18', 'node-v20.1.0', 'node@18', 'node-20', '/opt/node_18/bin/node18'].forEach(function (i) {
        should(runtimeOf(i)).eql('node', i);
      });
    });

    it('should recognize Bun', function () {
      ['bun', '/usr/local/bin/bun', '/home/ubuntu/.bun/bin/bun', 'bun.exe', 'bun-1.1'].forEach(function (i) {
        should(runtimeOf(i)).eql('bun', i);
      });
    });

    it('should not match paths that only contain the letters (#5990)', function () {
      ['/home/ubuntu/.venvs/bin/python', '/home/ubuntu/.venvs/bin/python3.11-orig',
       '/usr/bin/python3.11', 'bundle', 'bunx', 'ruby', 'bash', 'none', '', null, undefined].forEach(function (i) {
        should(runtimeOf(i)).eql(null, String(i));
      });
    });
  });

  describe('Common.sink.determineExecMode with explicit exec_mode: cluster', function () {
    function exec_mode_for(interpreter) {
      var app = { exec_interpreter: interpreter, exec_mode: 'cluster', instances: 2, pm_exec_path: 'app.mjs' };
      Common.sink.determineExecMode(app);
      return app.exec_mode;
    }

    it('should keep cluster_mode for atypical Node.js basenames', function () {
      ['node.exe', 'node64.exe', 'C:\\nvm\\v18.0.0\\node.exe', 'nodejs', 'node18', 'node@18', 'node-v20.1.0']
        .forEach(function (i) {
          should(exec_mode_for(i)).eql('cluster_mode', i);
        });
    });

    it('should keep cluster_mode for Bun', function () {
      should(exec_mode_for('bun.exe')).eql('cluster_mode');
      should(exec_mode_for('/home/ubuntu/.bun/bin/bun')).eql('cluster_mode');
    });

    it('should fall back to fork_mode for a non-JS interpreter', function () {
      should(exec_mode_for('bash')).eql('fork_mode');
      should(exec_mode_for('/usr/bin/python3')).eql('fork_mode');
      should(exec_mode_for('none')).eql('fork_mode');
    });
  });

  describe('Common.sink.determineExecMode default with -i', function () {
    it('should pick cluster_mode for atypical Node.js basenames', function () {
      var app = { exec_interpreter: 'node64.exe', instances: 2 };
      Common.sink.determineExecMode(app);
      should(app.exec_mode).eql('cluster_mode');
    });
  });
});
