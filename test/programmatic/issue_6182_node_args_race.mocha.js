/**
 * #6182 - cluster workers must start with the node_args of their own app.
 *
 * cluster.settings.execArgv is shared by the whole daemon and cluster.fork()
 * runs once the log files are open (asynchronous since 7.1.0): two apps
 * started together used to give a worker the node_args of the other app.
 */

process.chdir(__dirname);

var PM2    = require('../..');
var cst    = require('../../constants.js');
var should = require('should');
var fs     = require('fs');
var os     = require('os');
var path   = require('path');
var spawnSync = require('child_process').spawnSync;

var PM2_BIN  = path.resolve(__dirname, '../../bin/pm2');
// Bun runs cluster workers without node execArgv
var SKIP     = Boolean(process.versions.bun);
var DUMP_DIR = SKIP ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-6182-'));

// one heap size per app: visible in process.execArgv, harmless to start with
var APPS = [
  { name: 'argv-a', node_args: '--max-old-space-size=101' },
  { name: 'argv-b', node_args: '--max-old-space-size=202' },
  { name: 'argv-c' }
].map(function(app) {
  return Object.assign({
    script    : '../fixtures/issue-6182-argv.js',
    exec_mode : 'cluster',
    instances : 2,
    env       : { ARGV_DUMP_DIR: DUMP_DIR }
  }, app);
});

var WORKERS = APPS.length * 2;

function clearDumps() {
  fs.readdirSync(DUMP_DIR).forEach(function(f) { fs.unlinkSync(path.join(DUMP_DIR, f)); });
}

// execArgv of every worker started since the last clearDumps()
function readDumps(cb) {
  var tries = 0;
  (function wait() {
    var files = fs.readdirSync(DUMP_DIR).filter(function(f) { return /\.json$/.test(f); });
    if (files.length >= WORKERS)
      return cb(null, files.map(function(f) { return JSON.parse(fs.readFileSync(path.join(DUMP_DIR, f))); }));
    if (++tries > 100)
      return cb(new Error(files.length + '/' + WORKERS + ' workers dumped their execArgv'));
    setTimeout(wait, 100);
  })();
}

function heapFlags(execArgv) {
  return execArgv.filter(function(a) { return /^--max-old-space-size=/.test(a); });
}

// every worker has the flags of its app, and only those
function checkWorkers(done) {
  readDumps(function(err, workers) {
    if (err) return done(err);
    try {
      workers.length.should.eql(WORKERS);
      workers.forEach(function(w) {
        var app = APPS.filter(function(a) { return a.name === w.name; })[0];
        heapFlags(w.execArgv).should.eql(app.node_args ? [app.node_args] : [], w.name + ' started with ' + JSON.stringify(w.execArgv));
      });
    } catch (e) { return done(e); }
    done();
  });
}

describe('#6182 cluster workers keep the node_args of their app', function() {
  // no hook either: the after() kill would start a daemon for nothing
  if (SKIP) return;

  this.timeout(30000);

  before(function(done) {
    PM2.delete('all', function() { done(); });
  });

  after(function(done) {
    fs.rmSync(DUMP_DIR, { recursive: true, force: true });
    PM2.kill(done);
  });

  beforeEach(clearDumps);

  // the CLI starts the apps of a file in parallel, PM2.start({ apps }) one by one
  it('on pm2 start <ecosystem file> (CLI)', function(done) {
    var file = path.join(DUMP_DIR, 'ecosystem.config.js');
    var apps = APPS.map(function(app) {
      return Object.assign({}, app, { script: path.resolve(__dirname, app.script) });
    });
    fs.writeFileSync(file, 'module.exports = ' + JSON.stringify({ apps: apps }));
    var res = spawnSync(process.execPath, [PM2_BIN, 'start', file], { env: process.env, timeout: 20000 });
    fs.unlinkSync(file);
    if (res.status !== 0) return done(new Error(String(res.stderr)));
    checkWorkers(function(err) {
      PM2.delete('all', function() { done(err); });
    });
  });

  it('on a programmatic start of several cluster apps', function(done) {
    PM2.start({ apps: APPS }, function(err) {
      if (err) return done(err);
      checkWorkers(done);
    });
  });

  it('on a reload of all the apps together', function(done) {
    PM2.reload('all', function(err) {
      if (err) return done(err);
      checkWorkers(done);
    });
  });

  it('on a restart of all the apps together', function(done) {
    PM2.restart('all', function(err) {
      if (err) return done(err);
      checkWorkers(done);
    });
  });

  // pm2 update dumps, kills the daemon then resurrects
  it('on a resurrect (pm2 update)', function(done) {
    PM2.dump(function(err) {
      if (err) return done(err);
      var dump = fs.readFileSync(cst.DUMP_FILE_PATH);
      PM2.delete('all', function(err) {
        if (err) return done(err);
        fs.writeFileSync(cst.DUMP_FILE_PATH, dump);
        clearDumps();
        PM2.resurrect(function(err) {
          if (err) return done(err);
          checkWorkers(done);
        });
      });
    });
  });
});
