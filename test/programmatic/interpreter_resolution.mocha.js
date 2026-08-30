/**
 * Interpreter resolution for TypeScript files.
 *
 * `.ts` maps to bun (lib/API/interpreter.json), but on machines without bun
 * PM2 used to hard-fail ("Interpreter bun is NOT AVAILABLE in PATH") even
 * though Node.js can run .ts natively via type stripping:
 *   - 22.6-22.17 / 23.0-23.5 behind --experimental-strip-types
 *   - 22.18+ / 23.6+ by default
 * When bun is absent, resolveInterpreter now falls back to node whenever the
 * node version supports type stripping, injecting the flag where needed.
 */

process.chdir(__dirname);

var fs = require('fs');
var os = require('os');
var path = require('path');
var should = require('should');
var cst = require('../../constants.js');
var typestrip = require('../../lib/tools/typestrip.js');
var which = require('../../lib/tools/which.js');

describe('TypeScript interpreter resolution', function () {

  describe('typestrip.supportLevel', function () {
    var tests = [
      { version: '18.0.0',  expected: false },
      { version: '20.11.0', expected: false },
      { version: '22.5.0',  expected: false },
      { version: '22.6.0',  expected: 'flag' },
      { version: '22.17.1', expected: 'flag' },
      { version: '22.18.0', expected: 'native' },
      { version: '22.19.0', expected: 'native' },
      { version: '23.0.0',  expected: 'flag' },
      { version: '23.5.0',  expected: 'flag' },
      { version: '23.6.0',  expected: 'native' },
      { version: '24.0.0',  expected: 'native' },
      { version: '25.2.1',  expected: 'native' }
    ];

    tests.forEach(function (test) {
      it('should report ' + JSON.stringify(test.expected) + ' for node ' + test.version, function () {
        should(typestrip.supportLevel(test.version)).eql(test.expected);
      });
    });
  });

  // Under the bun runtime resolveInterpreter short-circuits .ts to
  // process.execPath before any of the logic tested here
  (cst.IS_BUN ? describe.skip : describe)('Common.sink.resolveInterpreter', function () {
    var Common = require('../../lib/Common');
    var ts_fixture = path.resolve(__dirname, '../fixtures/interpreter/echo.ts');
    var tsx_fixture = path.resolve(__dirname, '../fixtures/interpreter/echo.tsx');

    function resolve_app(exec_path) {
      var app = { pm_exec_path: exec_path, env: {}, node_args: [] };
      Common.sink.resolveInterpreter(app);
      return app;
    }

    describe('with bun in PATH', function () {
      before(function () {
        if (which('bun') == null)
          this.skip();
      });

      it('should keep bun as .ts interpreter', function () {
        should(resolve_app(ts_fixture).exec_interpreter).eql('bun');
      });
    });

    describe('without bun in PATH', function () {
      var saved_path;
      var node_only_bin;

      before(function () {
        saved_path = process.env.PATH;
        node_only_bin = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-node-only-'));
        fs.symlinkSync(process.execPath, path.join(node_only_bin, 'node'));
        process.env.PATH = node_only_bin;
      });

      after(function () {
        process.env.PATH = saved_path;
        fs.rmSync(node_only_bin, { recursive: true, force: true });
      });

      it('should fall back to node type stripping for .ts', function () {
        if (typestrip.supportLevel(process.versions.node) === false)
          this.skip();

        var app = resolve_app(ts_fixture);
        should(app.exec_interpreter).eql('node');

        var needs_flag = typestrip.supportLevel(process.versions.node) === 'flag';
        should(app.node_args.indexOf('--experimental-strip-types') !== -1).eql(needs_flag);
      });

      it('should keep requiring bun for .tsx (JSX cannot be stripped)', function () {
        should(function () { resolve_app(tsx_fixture); }).throw(/bun/);
      });

      // The running node is on the native tier, so exercise the flag and
      // error tiers by stubbing the version the resolver sees
      describe('on stubbed node versions', function () {
        var realResolvedNodeVersion;

        before(function () {
          realResolvedNodeVersion = typestrip.resolvedNodeVersion;
        });

        after(function () {
          typestrip.resolvedNodeVersion = realResolvedNodeVersion;
        });

        it('should inject --experimental-strip-types on flag-tier node', function () {
          typestrip.resolvedNodeVersion = () => '22.10.0';
          var app = resolve_app(ts_fixture);
          should(app.exec_interpreter).eql('node');
          should(app.node_args).containEql('--experimental-strip-types');
        });

        it('should not duplicate the flag when already present', function () {
          typestrip.resolvedNodeVersion = () => '22.10.0';
          var app = { pm_exec_path: ts_fixture, env: {}, node_args: ['--experimental-strip-types'] };
          Common.sink.resolveInterpreter(app);
          should(app.node_args.filter((a) => a === '--experimental-strip-types')).have.length(1);
        });

        it('should throw an actionable error when node cannot strip types', function () {
          typestrip.resolvedNodeVersion = () => '20.0.0';
          should(function () { resolve_app(ts_fixture); }).throw(/TypeScript apps require/);
        });
      });
    });
  });

  describe('ProcessUtils.enableTypeScript', function () {
    var ProcessUtils = require('../../lib/ProcessUtils');
    var fake_app_dir;

    before(function () {
      // Fake app with ts-node in its own node_modules, to prove ts-node is
      // resolved from the application dependencies and not from PM2's tree
      fake_app_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-fake-ts-app-'));
      var ts_node_dir = path.join(fake_app_dir, 'node_modules', 'ts-node');
      fs.mkdirSync(ts_node_dir, { recursive: true });
      fs.writeFileSync(path.join(ts_node_dir, 'package.json'),
        JSON.stringify({ name: 'ts-node', version: '0.0.0', main: 'register.js' }));
      fs.writeFileSync(path.join(ts_node_dir, 'register.js'),
        'global.__fake_ts_node_loaded = true;');
    });

    after(function () {
      fs.rmSync(fake_app_dir, { recursive: true, force: true });
      delete global.__fake_ts_node_loaded;
    });

    beforeEach(function () {
      delete global.__fake_ts_node_loaded;
    });

    it('should be a no-op for non-TypeScript files', function () {
      ProcessUtils.enableTypeScript(path.join(fake_app_dir, 'app.js'), fake_app_dir);
      should(global.__fake_ts_node_loaded).be.undefined();
    });

    it('should not load ts-node for .ts when the runtime strips types', function () {
      if (!(process.features && process.features.typescript))
        this.skip();
      ProcessUtils.enableTypeScript(path.join(fake_app_dir, 'app.ts'), fake_app_dir);
      should(global.__fake_ts_node_loaded).be.undefined();
    });

    it('should load ts-node from the app dependencies for .tsx', function () {
      ProcessUtils.enableTypeScript(path.join(fake_app_dir, 'app.tsx'), fake_app_dir);
      should(global.__fake_ts_node_loaded).eql(true);
    });
  });

  describe('God.nodeApp daemon-side strip flag (cluster)', function () {
    var cluster = require('cluster');
    var EventEmitter = require('events').EventEmitter;
    var realFork, realSupportLevel, savedExecArgv;

    before(function () {
      realFork = cluster.fork;
      realSupportLevel = typestrip.supportLevel;
      savedExecArgv = cluster.settings.execArgv;
      cluster.fork = function () { return new EventEmitter(); };
    });

    after(function () {
      cluster.fork = realFork;
      typestrip.supportLevel = realSupportLevel;
      cluster.settings.execArgv = savedExecArgv;
    });

    function node_app(script, done_check) {
      var God = { bus: { emit: function () {} } };
      require('../../lib/God/ClusterMode.js')(God);
      God.nodeApp({ name: 'test', pm_id: 0, pm_exec_path: script, node_args: [] }, done_check);
    }

    it('should append --experimental-strip-types for .ts on a flag-tier daemon', function (done) {
      typestrip.supportLevel = () => 'flag';
      node_app('/tmp/dummy_app.ts', function () {
        should(cluster.settings.execArgv).containEql('--experimental-strip-types');
        done();
      });
    });

    it('should leave execArgv untouched for .js apps', function (done) {
      typestrip.supportLevel = () => 'flag';
      node_app('/tmp/dummy_app.js', function () {
        should(cluster.settings.execArgv).not.containEql('--experimental-strip-types');
        done();
      });
    });

    it('should leave execArgv untouched on a native-tier daemon', function (done) {
      typestrip.supportLevel = () => 'native';
      node_app('/tmp/dummy_app.ts', function () {
        should(cluster.settings.execArgv).not.containEql('--experimental-strip-types');
        done();
      });
    });
  });

  describe('God.forkMode routing for node-run TypeScript', function () {
    // Stub child_process.spawn to capture (command, args) without spawning,
    // same pattern as issue_5990_bun_substring_match.mocha.js
    var child_process = require('child_process');
    var realSpawn;
    var capturedArgs;

    before(function () {
      realSpawn = child_process.spawn;
      child_process.spawn = function (command, args) {
        capturedArgs = { command: command, args: args };
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

    it('should pass the strip-types flag and wrap in ProcessContainerFork.js', function (done) {
      var God = { bus: { emit: function () {} }, clusters_db: {} };
      require('../../lib/God/ForkMode.js')(God);

      capturedArgs = null;
      God.forkMode({
        name: 'test-ts',
        pm_id: 0,
        exec_interpreter: 'node',
        node_args: ['--experimental-strip-types'],
        pm_exec_path: '/tmp/dummy_app.ts',
        pm_pid_path: '/tmp/dummy.pid',
        pm_out_log_path: '/dev/null',
        pm_err_log_path: '/dev/null',
        env: {}
      }, function () {});

      setTimeout(function () {
        should.exist(capturedArgs);
        capturedArgs.command.should.eql('node');
        capturedArgs.args.should.containEql('--experimental-strip-types');
        capturedArgs.args[capturedArgs.args.length - 1].should.match(/ProcessContainerFork\.js$/);
        done();
      }, 50);
    });
  });

});
