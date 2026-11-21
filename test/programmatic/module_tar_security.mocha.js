/**
 * TAR modules: names taken from a folder or an archive never reach a shell
 * nor a path outside the modules folder (GHSA-wg6h-79r6-hmj7,
 * GHSA-47x5-53jc-g6m5)
 */

process.chdir(__dirname);

var should = require('should');
var fs     = require('fs');
var os     = require('os');
var path   = require('path');
var spawnSync = require('child_process').spawnSync;
var cst    = require('../../constants.js');
var TAR    = require('../../lib/API/Modules/TAR.js');

var WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-tar-sec-'));

// what a shell substitution in a name would create, from the cwd of the
// shell (no '/': it has to fit in a folder name)
var MARK   = 'PWNED-tar-' + process.pid;
var PWNED  = path.join(process.cwd(), MARK);
var INJECT = '$(touch ' + MARK + ')';

// stands in for the API: records what install would start
function fakePM2() {
  var started = [];
  return {
    started : started,
    start   : function(conf, opts, cb) { started.push(opts.cwd); cb(null, []); },
    exitCli : function() {}
  };
}

// a module archive whose package.json is named `name`
function archive(name) {
  var dir = fs.mkdtempSync(path.join(WORK, 'pkg-'));
  fs.mkdirSync(path.join(dir, 'module'));
  fs.writeFileSync(path.join(dir, 'module', 'package.json'), JSON.stringify({
    name    : name,
    version : '1.0.0',
    apps    : [{ name: name, script: 'index.js' }]
  }));
  fs.writeFileSync(path.join(dir, 'module', 'index.js'), 'setInterval(function() {}, 1000)');
  fs.writeFileSync(path.join(dir, 'module', 'MARKER.txt'), 'marker');
  var file = path.join(dir, 'module.tar.gz');
  spawnSync('tar', ['zcf', file, '-C', dir, 'module']);
  return file;
}

function exists(p) {
  try { fs.statSync(p); return true; } catch (e) { return false; }
}

describe('TAR modules: names from folders and archives', function() {
  this.timeout(20000);

  // tar and a POSIX shell
  if (process.platform === 'win32') return;

  afterEach(function() {
    try { fs.unlinkSync(PWNED); } catch (e) {}
  });

  after(function() {
    fs.rmSync(WORK, { recursive: true, force: true });
    fs.rmSync(path.join(cst.PM2_HOME, 'escaped-demo'), { recursive: true, force: true });
  });

  describe('packager (pm2 package / pm2 publish)', function() {
    it('does not run a folder name through a shell', function(done) {
      var dir = fs.mkdtempSync(path.join(WORK, 'testmod' + INJECT + '-'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'testmod', version: '1.0.0', apps: [] }));
      TAR.packager(dir, WORK, function() {
        exists(PWNED).should.be.false();
        done();
      });
    });

    it('does not pass a folder name starting with - as a tar option', function(done) {
      var dir = fs.mkdtempSync(path.join(WORK, '--checkpoint-action=exec=touch ' + MARK + '-'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'optmod', version: '1.0.0', apps: [] }));
      TAR.packager(dir, WORK, function(err) {
        should.exist(err);
        exists(PWNED).should.be.false();
        done();
      });
    });

    it('does not run a package.json version through a shell', function(done) {
      var dir = fs.mkdtempSync(path.join(WORK, 'vermod-'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'vermod', version: '1.0.0' + INJECT, apps: [] }));
      TAR.packager(dir, WORK, function(err, res) {
        exists(PWNED).should.be.false();
        // the version can not move the archive out of the target folder
        path.dirname(res.path).should.eql(WORK);
        done();
      });
    });
  });

  describe('install (pm2 install module.tar.gz)', function() {
    it('refuses a module name escaping the modules folder', function(done) {
      var pm2 = fakePM2();
      TAR.install(pm2, archive('../escaped-demo'), {}, function(err) {
        should.exist(err);
        exists(path.join(cst.PM2_HOME, 'escaped-demo')).should.be.false();
        pm2.started.length.should.eql(0);
        done();
      });
    });

    it('refuses a module name with shell syntax, also with --install', function(done) {
      var pm2 = fakePM2();
      TAR.install(pm2, archive('x' + INJECT), { install: true }, function(err) {
        should.exist(err);
        exists(PWNED).should.be.false();
        pm2.started.length.should.eql(0);
        done();
      });
    });

    it('still installs and starts a regular module', function(done) {
      var pm2 = fakePM2();
      TAR.install(pm2, archive('good-tar-mod'), {}, function(err) {
        should(err).be.null();
        var dir = path.join(cst.DEFAULT_MODULE_PATH, 'good-tar-mod');
        exists(path.join(dir, 'MARKER.txt')).should.be.true();
        pm2.started.should.eql([dir]);
        fs.rmSync(dir, { recursive: true, force: true });
        done();
      });
    });
  });

  describe('uninstall', function() {
    it('refuses a name outside the modules folder', function(done) {
      var victim = path.join(cst.PM2_HOME, 'escaped-demo');
      fs.mkdirSync(victim, { recursive: true });
      fs.writeFileSync(path.join(victim, 'package.json'), JSON.stringify({ name: 'x', apps: [{ name: 'x' }] }));
      var pm2 = { _operate: function(action, name, cb) { cb(); } };
      TAR.uninstall(pm2, '../escaped-demo', function(err) {
        should.exist(err);
        exists(victim).should.be.true();
        done();
      });
    });
  });
});
