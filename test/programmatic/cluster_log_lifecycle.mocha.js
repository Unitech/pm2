
/**
 * Cluster mode daemon-side log streams (ClusterMode.js):
 * - files created by the (root) daemon are chowned to the app uid/gid,
 *   the worker reopens them after setuid (EACCES crash loop otherwise)
 * - reloadLogs on a stopped cluster app: no daemon crash
 *   (ERR_IPC_CHANNEL_CLOSED) and no reopened streams leaking fds
 */
var God = require('../../lib/God');
var Common = require('../../lib/Common');
var StdioLogger = require('../../lib/God/StdioLogger.js');
var fs = require('fs');
var os = require('os');
var path = require('path');
var should = require('should');

process.chdir(__dirname);

var LOG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-clu-logs-'));

function getConf(name, extra) {
  var conf = Common.prepareAppConf({ cwd : process.cwd() }, {
    script     : '../fixtures/echo.js',
    name       : name,
    instances  : 1,
    exec_mode  : 'cluster_mode',
    merge_logs : true,
    out_file   : path.join(LOG_DIR, name + '-out.log'),
    error_file : path.join(LOG_DIR, name + '-err.log'),
    log_file   : path.join(LOG_DIR, name + '-all.log')
  });
  // uid/gid set after prepareAppConf: it resolves names through /etc/passwd
  for (var k in extra) conf[k] = extra[k];
  return conf;
}

function logFiles(name) {
  return ['-out.log', '-err.log', '-all.log'].map(function(s) {
    return path.join(LOG_DIR, name + s);
  });
}

function countFds() {
  return fs.readdirSync('/dev/fd').length;
}

function deleteAll(cb) {
  var ids = Object.keys(God.clusters_db);
  (function next() {
    var id = ids.shift();
    if (id === undefined) {
      God.clusters_db = {};
      return cb();
    }
    God.deleteProcessId(id, function() { next(); });
  })();
}

describe('Cluster mode log lifecycle', function() {
  this.timeout(20000);

  var real_getuid = process.getuid;
  var real_chown = fs.chownSync;
  var chowned = [];

  beforeEach(function() {
    chowned = [];
    fs.chownSync = function(file, uid, gid) {
      chowned.push({ file: file, uid: uid, gid: gid });
    };
  });

  afterEach(function(done) {
    process.getuid = real_getuid;
    fs.chownSync = real_chown;
    deleteAll(done);
  });

  after(function() {
    try { fs.rmSync(LOG_DIR, { recursive: true, force: true }); } catch(e) {}
  });

  if (!process.getuid) return;

  describe('log file ownership', function() {
    it('should not chown when the daemon is not root', function(done) {
      if (real_getuid() === 0) this.skip();
      God.prepare(getConf('own-noroot', { uid: real_getuid(), gid: process.getgid() }), function(err, procs) {
        should(err).be.null();
        procs[0].pm2_env.status.should.eql('online');
        chowned.length.should.eql(0);
        done();
      });
    });

    it('should chown the log files it creates to the app uid/gid when root', function(done) {
      var uid = real_getuid(), gid = process.getgid();
      process.getuid = function() { return 0; };

      God.prepare(getConf('own-root', { uid: uid, gid: gid }), function(err, procs) {
        should(err).be.null();
        procs[0].pm2_env.status.should.eql('online');
        chowned.map(function(c) { return c.file; }).sort().should.eql(logFiles('own-root').sort());
        chowned.forEach(function(c) {
          c.uid.should.eql(uid);
          c.gid.should.eql(gid);
        });
        done();
      });
    });

    it('should chown files recreated by reloadLogs (logrotate) and leave existing ones', function(done) {
      var uid = real_getuid(), gid = process.getgid();
      process.getuid = function() { return 0; };

      God.prepare(getConf('own-reload', { uid: uid, gid: gid }), function(err, procs) {
        should(err).be.null();
        var files = logFiles('own-reload');
        // rotate the out file away only
        fs.renameSync(files[0], files[0] + '.1');
        chowned = [];
        God.reloadLogs({}, function() {
          setTimeout(function() {
            chowned.map(function(c) { return c.file; }).should.eql([files[0]]);
            done();
          }, 500);
        });
      });
    });

    it('should not chown files that already exist', function(done) {
      var uid = real_getuid(), gid = process.getgid();
      logFiles('own-exist').forEach(function(f) { fs.writeFileSync(f, ''); });
      process.getuid = function() { return 0; };

      God.prepare(getConf('own-exist', { uid: uid, gid: gid }), function(err) {
        should(err).be.null();
        chowned.length.should.eql(0);
        done();
      });
    });

    it('should resolve uid/gid like setuid (numbers or names)', function() {
      process.getuid = function() { return 0; };
      should(StdioLogger.logOwner({})).be.null();
      StdioLogger.logOwner({ uid: 'root' }).should.eql({ uid: 0, gid: -1 });
      StdioLogger.logOwner({ uid: '1001', gid: 20 }).should.eql({ uid: 1001, gid: 20 });
      should(StdioLogger.logOwner({ uid: 'no-such-user-pm2' })).be.null();
      process.getuid = function() { return 1000; };
      should(StdioLogger.logOwner({ uid: 1001 })).be.null();
    });
  });

  describe('concurrent reloadLogs on an online cluster app', function() {
    it('should keep the daemon alive and keep logging', function(done) {
      God.prepare(getConf('online-reload'), function(err, procs) {
        should(err).be.null();
        for (var i = 0; i < 5; i++) God.reloadLogs({}, function() {});
        setTimeout(function() {
          var out = logFiles('online-reload')[0];
          var size = fs.statSync(out).size;
          setTimeout(function() {
            fs.statSync(out).size.should.be.above(size);
            procs[0].pm2_env.status.should.eql('online');
            done();
          }, 500);
        }, 500);
      });
    });
  });

  describe('reloadLogs on a stopped cluster app', function() {
    it('should keep the daemon alive and not leak fds', function(done) {
      God.prepare(getConf('stopped-reload'), function(err, procs) {
        should(err).be.null();
        var id = procs[0].pm2_env.pm_id;

        God.stopProcessId(id, function(err) {
          should(err).be.null();
          // let the 'close' of the stdio pipes release the daemon streams
          setTimeout(function() {
            var fds = countFds();
            var uncaught = null;
            function onUncaught(e) { uncaught = e; }
            process.on('uncaughtException', onUncaught);

            God.reloadLogs({}, function() {
              God.reloadLogs({}, function() {
                setTimeout(function() {
                  process.removeListener('uncaughtException', onUncaught);
                  should(uncaught).be.null();
                  countFds().should.eql(fds);
                  done();
                }, 500);
              });
            });
          }, 500);
        });
      });
    });
  });
});
