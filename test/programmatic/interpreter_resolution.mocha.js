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
      // Worker-shaped stub: nodeApp attaches StdioLogger on worker.process
      cluster.fork = function () {
        var worker = new EventEmitter();
        worker.process = new EventEmitter();
        worker.process.stdout = new EventEmitter();
        worker.process.stderr = new EventEmitter();
        return worker;
      };
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

describe('Node version selectors and interpreter paths (#6044)', function () {
  var Common = require('../../lib/Common');
  var root, savedNvm, savedPrintOut, savedPrintError;
  var nvmEnv = cst.IS_WINDOWS ? 'NVM_HOME' : 'NVM_DIR';
  var messages;
  var paths;

  function nvmNode(version) {
    var nodePath = path.join(root, 'nvm', cst.IS_WINDOWS
      ? 'v' + version + '/node.exe'
      : 'versions/node/v' + version + '/bin/node');
    fs.mkdirSync(path.dirname(nodePath), { recursive: true });
    if (!fs.existsSync(nodePath))
      fs.symlinkSync(process.execPath, nodePath);
    return nodePath;
  }

  before(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-interpreter-at-'));
    savedNvm = process.env[nvmEnv];
    process.env[nvmEnv] = path.join(root, 'nvm');
    savedPrintOut = Common.printOut;
    savedPrintError = Common.printError;
    Common.printOut = Common.printError = function (message) { messages.push(message); };
    paths = [
      path.join(root, 'me@org', 'bin', 'node'),
      path.join(root, 'Cellar', 'node@22', '22.18.0', 'bin', 'node'),
      path.relative(process.cwd(), path.join(root, 'relative', 'node@22', 'bin', 'node')),
      path.join(root, 'ordinary', 'bin', 'node')
    ];
    paths.forEach(function (interpreterPath) {
      fs.mkdirSync(path.dirname(interpreterPath), { recursive: true });
      fs.symlinkSync(process.execPath, interpreterPath);
      // Make every old, misparsed NVM target available.  A regression may
      // select the wrong binary, but can never run an NVM installation.
      if (interpreterPath.indexOf('@') !== -1)
        nvmNode(interpreterPath.split('@')[1]);
    });
    nvmNode('20.12.2');
    nvmNode('22/bin/missing');
    ['python@3', 'C:\\Users\\me@org\\node.exe',
      'C:\\Program Files\\node@22\\node.exe'].forEach(function (value) {
      nvmNode(value.split('@')[1]);
    });
  });

  beforeEach(function () { messages = []; });

  after(function () {
    if (savedNvm === undefined)
      delete process.env[nvmEnv];
    else
      process.env[nvmEnv] = savedNvm;
    Common.printOut = savedPrintOut;
    Common.printError = savedPrintError;
    fs.rmSync(root, { recursive: true, force: true });
  });

  ['resolveInterpreter', 'mergeEnvironmentVariables'].forEach(function (method) {
    it(method + ' should preserve executable paths containing @', function () {
      paths.forEach(function (interpreterPath) {
        var app = { pm_exec_path: 'app.js', exec_interpreter: interpreterPath, env: {} };
        var resolved = method === 'resolveInterpreter'
          ? Common.sink.resolveInterpreter(app)
          : Common.mergeEnvironmentVariables(app).current_conf;
        should(resolved.exec_interpreter).eql(interpreterPath);
      });
      should(messages).eql([]);
    });

    it(method + ' should still resolve a bare node@version selector', function () {
      var app = { pm_exec_path: 'app.js', exec_interpreter: 'node@20.12.2', env: {} };
      var resolved = method === 'resolveInterpreter'
        ? Common.sink.resolveInterpreter(app)
        : Common.mergeEnvironmentVariables(app).current_conf;
      should(resolved.exec_interpreter).eql(nvmNode('20.12.2'));
    });

    it(method + ' should keep the cluster version-selector restriction', function () {
      var app = {
        pm_exec_path: 'app.js', exec_interpreter: 'node@20.12.2',
        exec_mode: 'cluster_mode', env: {}
      };
      if (method === 'resolveInterpreter')
        should(function () { Common.sink.resolveInterpreter(app); }).throw(/NOT AVAILABLE/);
      else
        should(Common.mergeEnvironmentVariables(app).current_conf.exec_interpreter).eql('node@20.12.2');
      should(messages.join('\n')).containEql('Choosing the Node.js version in cluster mode is not supported');
    });
  });

  it('should report unavailable path interpreters without invoking NVM', function () {
    var interpreterPath = path.join(root, 'node@22', 'bin', 'missing');
    should(function () {
      Common.sink.resolveInterpreter({
        pm_exec_path: 'app.js', exec_interpreter: interpreterPath, env: {}
      });
    }).throw(new RegExp('Interpreter .*missing is NOT AVAILABLE'));
    should(messages).eql([]);
  });

  it('should not interpret other @ commands or Windows paths as Node selectors', function () {
    ['python@3', 'C:\\Users\\me@org\\node.exe',
      'C:\\Program Files\\node@22\\node.exe'].forEach(function (value) {
      should(Common.mergeEnvironmentVariables({ exec_interpreter: value, env: {} })
        .current_conf.exec_interpreter).eql(value);
    });
    should(messages).eql([]);
  });

  it('should preserve the default-derived process.execPath through environment merging', function () {
    var originalExecPath = process.execPath;
    var scriptPath = path.join(root, 'app.custom');
    fs.writeFileSync(scriptPath, 'setInterval(function () {}, 1000);');
    try {
      process.execPath = paths[0];
      var app = Common.sink.resolveInterpreter({ pm_exec_path: scriptPath, env: {} });
      should(app.exec_interpreter).eql(paths[0]);
      should(Common.mergeEnvironmentVariables(app).current_conf.exec_interpreter).eql(paths[0]);
      should(messages).eql([]);
    } finally {
      process.execPath = originalExecPath;
    }
  });

  it('should keep environment precedence and unrelated current configuration', function () {
    var interpreterPath = paths[0];
    var app = {
      exec_interpreter: interpreterPath, instances: 2,
      env: { VALUE: 'base', BASE: 'kept' }, env_production: { VALUE: 'production' }
    };
    var result = Common.mergeEnvironmentVariables(app, 'production', {
      production: { env: { VALUE: 'deploy', DEPLOY: 'kept' } }
    });
    should(result.VALUE).eql('production');
    should(result.BASE).eql('kept');
    should(result.DEPLOY).eql('kept');
    should(result.current_conf.exec_interpreter).eql(interpreterPath);
    should(result.current_conf.instances).eql(2);
    should(app.env.VALUE).eql('base');
    should(messages).eql([]);
  });
});
