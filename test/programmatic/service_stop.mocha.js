/**
 * #5000 - systemd stop command (ExecStop=pm2 kill) run after the daemon exited
 * on its own (`pm2 update`) must not kill the daemon that replaced it, nor
 * spawn one
 */

process.chdir(__dirname);

var fs          = require('fs');
var path        = require('path');
var spawnSync   = require('child_process').spawnSync;
var should      = require('should');
var PM2         = require('../..');
var cst         = require('../../constants.js');
var ServiceStop = require('../../lib/tools/serviceStop.js');

var PM2_BIN = path.resolve(__dirname, '../../bin/pm2');
var SERVICE_VARS = ['INVOCATION_ID', 'SERVICE_RESULT', 'MAINPID', 'EXIT_CODE', 'EXIT_STATUS', 'MANAGERPID', 'SMF_FMRI', 'SMF_METHOD'];

var V2_UNIT    = '0::/system.slice/pm2-ubuntu.service\n';
var V2_CONTROL = '0::/system.slice/pm2-ubuntu.service/.control\n';
var V2_SESSION = '0::/user.slice/user-1000.slice/session-3.scope\n';
var V1_UNIT    = '12:pids:/system.slice/pm2-ubuntu.service\n1:name=systemd:/system.slice/pm2-ubuntu.service\n';

describe('Service stop guard #5000', function() {
  describe('getStopContext', function() {
    var KILL = ['kill'];

    it('should apply to a stop command run after the main process exited', function() {
      ServiceStop.getStopContext({ SERVICE_RESULT: 'success', INVOCATION_ID: 'a1', EXIT_CODE: 'exited' }, ['-s', 'kill'])
        .should.eql({ invocation_id: 'a1' });
    });

    it('should only apply to pm2 kill (ExecStop=pm2 delete web of a oneshot unit)', function() {
      var env = { SERVICE_RESULT: 'success', INVOCATION_ID: 'a1', EXIT_CODE: 'exited' };
      [['delete', 'web'], ['stop', 'all'], ['save'], ['delete', 'kill'], []].forEach(function(args) {
        should(ServiceStop.getStopContext(env, args)).be.null();
      });
    });

    it('should not apply while the main process is alive (operator stop)', function() {
      should(ServiceStop.getStopContext({ SERVICE_RESULT: 'success', INVOCATION_ID: 'a1', MAINPID: '42' }, KILL)).be.null();
    });

    it('should not apply to processes of a unit main process tree (CI runner jobs)', function() {
      should(ServiceStop.getStopContext({ INVOCATION_ID: 'a1' }, KILL)).be.null();
    });

    it('should not apply outside systemd (shell, systemd < 232, other init systems)', function() {
      should(ServiceStop.getStopContext({}, KILL)).be.null();
      should(ServiceStop.getStopContext({ SERVICE_RESULT: 'success' }, KILL)).be.null();
      should(ServiceStop.getStopContext({ SMF_FMRI: 'svc:/application/pm2_user:default', SMF_METHOD: 'stop' }, KILL)).be.null();
    });
  });

  describe('parseCgroup', function() {
    it('should read cgroup v2 and strip the .control sub-cgroup', function() {
      ServiceStop.parseCgroup(V2_UNIT).should.eql('/system.slice/pm2-ubuntu.service');
      ServiceStop.parseCgroup(V2_CONTROL).should.eql('/system.slice/pm2-ubuntu.service');
    });

    it('should read the name=systemd hierarchy of cgroup v1', function() {
      ServiceStop.parseCgroup(V1_UNIT).should.eql('/system.slice/pm2-ubuntu.service');
    });

    it('should return null without content', function() {
      should(ServiceStop.parseCgroup(null)).be.null();
      should(ServiceStop.parseCgroup('')).be.null();
    });
  });

  describe('decide', function() {
    var ctx = { invocation_id: 'a1' };

    it('should skip when no daemon answered', function() {
      ServiceStop.decide(ctx, null, V2_CONTROL, null).action.should.eql('skip');
    });

    it('should run on the daemon started by this unit run (oneshot units)', function() {
      ServiceStop.decide(ctx, { env: { INVOCATION_ID: 'a1' } }, V2_CONTROL, V2_SESSION).action.should.eql('run');
    });

    it('should run on a daemon in the unit cgroup', function() {
      ServiceStop.decide(ctx, { pid: 1, env: {} }, V2_CONTROL, V2_UNIT).action.should.eql('run');
    });

    it('should not trust a cgroup that is not a service unit', function() {
      ServiceStop.decide(ctx, { pid: 1, env: {} }, V2_SESSION, V2_SESSION).action.should.eql('skip');
      ServiceStop.decide(ctx, { pid: 1, env: {} }, '0::/\n', '0::/\n').action.should.eql('skip');
    });

    it('should skip a daemon started outside the unit (pm2 update from a shell)', function() {
      ServiceStop.decide(ctx, { pid: 1, env: {} }, V2_CONTROL, V2_SESSION).action.should.eql('skip');
      ServiceStop.decide(ctx, { pid: 1, env: { INVOCATION_ID: 'other-unit' } }, V2_CONTROL, V2_SESSION).action.should.eql('skip');
    });

    it('should skip an old daemon without pid unless started by this run', function() {
      ServiceStop.decide(ctx, { env: {} }, V2_CONTROL, null).action.should.eql('skip');
    });
  });

  describe('pm2 CLI as a stop command', function() {
    if (process.platform === 'win32') return;

    // run from a .service unit (self-hosted runner...), the test daemon is in
    // the same cgroup and is rightly treated as started by the service
    var self_cgroup = ServiceStop.parseCgroup((function() {
      try { return fs.readFileSync('/proc/self/cgroup', 'utf8'); } catch(e) { return null; }
    })());
    if (self_cgroup && /\.service$/.test(self_cgroup)) return;

    this.timeout(30000);

    var pm2;
    var home = process.env.PM2_HOME || cst.PM2_HOME;

    function runPm2(args, env) {
      var child_env = Object.assign({}, process.env);
      SERVICE_VARS.forEach(function(k) { delete child_env[k]; });
      // the Docker test image sets PM2_SILENT, which mutes the output checked here
      delete child_env.PM2_SILENT;
      Object.assign(child_env, env);
      return spawnSync(process.execPath, [PM2_BIN].concat(args), { env: child_env, encoding: 'utf8', timeout: 20000 });
    }

    function daemonPid() {
      try {
        return parseInt(fs.readFileSync(path.join(home, 'pm2.pid'), 'utf8'), 10);
      } catch(e) {
        return null;
      }
    }

    function isAlive(pid) {
      try {
        process.kill(pid, 0);
        return true;
      } catch(e) {
        return false;
      }
    }

    // the daemon exits shortly after answering killMe
    function waitDead(pid, cb, tries) {
      tries = tries || 0;
      if (!isAlive(pid) || tries === 30) return cb(isAlive(pid));
      setTimeout(function() { waitDead(pid, cb, tries + 1); }, 100);
    }

    function startDaemon(invocation_id, cb) {
      SERVICE_VARS.forEach(function(k) { delete process.env[k]; });
      if (invocation_id) process.env.INVOCATION_ID = invocation_id;
      pm2 = new PM2.custom({ cwd: __dirname });
      pm2.connect(function(err) {
        delete process.env.INVOCATION_ID;
        if (err) return cb(err);
        pm2.start({ script: '../fixtures/child.js', name: 'child' }, function(err) {
          pm2.disconnect();
          cb(err);
        });
      });
    }

    function killDaemon(done) {
      runPm2(['kill'], {});
      done();
    }

    afterEach(killDaemon);

    var STOP_ENV = { SERVICE_RESULT: 'success', EXIT_CODE: 'exited', EXIT_STATUS: '0', INVOCATION_ID: 'unit-run-1' };

    it('should leave a daemon started outside the unit running (pm2 update)', function(done) {
      startDaemon(null, function(err) {
        should(err).be.null();
        var pid = daemonPid();

        var res = runPm2(['kill'], STOP_ENV);
        res.status.should.eql(0);
        res.stdout.should.containEql('daemon not started by this service');

        // only kill is guarded
        runPm2(['ping'], STOP_ENV).stdout.should.not.containEql('systemd stop command');

        isAlive(pid).should.be.true();
        daemonPid().should.eql(pid);
        var list = runPm2(['jlist'], {});
        JSON.parse(list.stdout).filter(function(p) {
          return p.pm2_env.status === 'online';
        }).length.should.eql(1);
        done();
      });
    });

    it('should kill the daemon started by this unit run', function(done) {
      startDaemon('unit-run-1', function(err) {
        should(err).be.null();
        var pid = daemonPid();

        var res = runPm2(['kill'], STOP_ENV);
        res.status.should.eql(0);
        res.stdout.should.containEql('daemon started by this service');
        waitDead(pid, function(alive) {
          alive.should.be.false();
          done();
        });
      });
    });

    it('should kill as before while the unit main process is alive', function(done) {
      startDaemon(null, function(err) {
        should(err).be.null();
        var pid = daemonPid();

        var res = runPm2(['kill'], Object.assign({ MAINPID: '1' }, STOP_ENV));
        res.status.should.eql(0);
        res.stdout.should.not.containEql('systemd stop command');
        waitDead(pid, function(alive) {
          alive.should.be.false();
          done();
        });
      });
    });

    it('should not spawn a daemon when none is running', function(done) {
      var res = runPm2(['kill'], STOP_ENV);
      res.status.should.eql(0);
      res.stdout.should.containEql('no running daemon');

      setTimeout(function() {
        fs.existsSync(path.join(home, 'rpc.sock')).should.be.false();
        should(daemonPid()).be.null();
        done();
      }, 1000);
    });

    it('should give up on a daemon that does not answer', function(done) {
      var axon = require('../../modules/pm2-axon');
      var rep  = axon.socket('rep');
      var rpc_file = path.join(home, 'rpc.sock');

      // never replies to getReport (bind() drops its callback for unix sockets)
      rep.on('message', function() {});
      rep.bind(rpc_file);
      rep.once('bind', function() {
        var started = Date.now();
        var res = runPm2(['kill'], STOP_ENV);
        res.status.should.eql(0);
        res.stdout.should.containEql('no running daemon');
        (Date.now() - started).should.be.below(10000);
        rep.close();

        setTimeout(function() {
          should(daemonPid()).be.null();
          done();
        }, 1000);
      });
    });
  });
});
