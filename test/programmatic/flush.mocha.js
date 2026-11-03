process.env.NODE_ENV = 'test';

var PM2      = require('../..');
var should   = require('should');
var fs       = require('fs');
var path     = require('path');
var os       = require('os');
var execFile = require('child_process').execFile;

describe('Programmatic flush feature test', function() {
  this.timeout(30000);

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });
  var logDir;
  var procs;
  var target;
  var other;
  var shared;
  var merged;
  var contents = 'log contents\n';
  var daemonMarker = 'flush test daemon log\n';

  function config(name, opts) {
    return Object.assign({
      script: './child.js',
      name: name,
      out_file: path.join(logDir, name + '-out.log'),
      error_file: path.join(logDir, name + '-err.log'),
      merge_logs: false
    }, opts);
  }

  function checkLogs(proc, out, err, combined) {
    fs.readFileSync(proc.pm_out_log_path, 'utf8').should.eql(out ? '' : contents);
    fs.readFileSync(proc.pm_err_log_path, 'utf8').should.eql(err ? '' : contents);
    if (proc.pm_log_path)
      fs.readFileSync(proc.pm_log_path, 'utf8').should.eql(combined ? '' : contents);
  }

  function checkTarget(out, err, combined) {
    target.forEach(function(proc) {
      checkLogs(proc, out, err, combined);
    });
    checkLogs(other, false, false, false);
  }

  function flushCLI(args, cb) {
    execFile(process.execPath, [path.resolve(__dirname, '../../bin/pm2'), 'flush'].concat(args), {
      env: Object.assign({}, process.env, {
        PM2_HOME: pm2.pm2_home,
        PM2_SILENT: '',
        PM2_PROGRAMMATIC: 'false'
      }),
      timeout: 20000
    }, function(err, stdout, stderr) {
      should(err).be.null();
      cb(stdout, stderr);
    });
  }

  before(function(done) {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-flush-'));
    pm2.delete('all', function() {
      pm2.start({ apps: [
        config('flush-target', {
          exec_mode: 'cluster',
          instances: 2,
          log_file: path.join(logDir, 'combined.log')
        }),
        config('flush-other'),
        config('flush-shared', {
          out_file: path.join(logDir, 'shared.log'),
          error_file: path.join(logDir, 'shared.log')
        }),
        config('flush-merged', {
          exec_mode: 'cluster',
          instances: 2,
          merge_logs: true
        })
      ] }, function(err) {
        should(err).be.null();
        // Stop writers before seeding files to avoid races with log output.
        pm2.stop('all', function(err) {
          should(err).be.null();
          pm2.list(function(err, list) {
            should(err).be.null();
            procs = list.map(function(proc) { return proc.pm2_env; });
            target = procs.filter(function(proc) { return proc.name === 'flush-target'; });
            other = procs.filter(function(proc) { return proc.name === 'flush-other'; })[0];
            shared = procs.filter(function(proc) { return proc.name === 'flush-shared'; })[0];
            merged = procs.filter(function(proc) { return proc.name === 'flush-merged'; });
            target.length.should.eql(2);
            merged.length.should.eql(2);
            target[0].pm_out_log_path.should.not.eql(target[1].pm_out_log_path);
            merged[0].pm_out_log_path.should.eql(merged[1].pm_out_log_path);
            shared.pm_out_log_path.should.eql(shared.pm_err_log_path);
            done();
          });
        });
      });
    });
  });

  beforeEach(function() {
    procs.forEach(function(proc) {
      [proc.pm_out_log_path, proc.pm_err_log_path, proc.pm_log_path].forEach(function(file) {
        if (file)
          fs.writeFileSync(file, contents);
      });
    });
    fs.appendFileSync(pm2._conf.PM2_LOG_FILE_PATH, daemonMarker);
  });

  after(function(done) {
    pm2.delete('all', function() {
      fs.readdirSync(logDir).forEach(function(file) {
        fs.unlinkSync(path.join(logDir, file));
      });
      fs.rmdirSync(logDir);
      pm2.disconnect(done);
    });
  });

  it('flush all logs with the existing callback API', function(done) {
    pm2.flush(undefined, function(err, list) {
      should(err).be.null();
      list.length.should.eql(procs.length);
      procs.forEach(function(proc) { checkLogs(proc, true, true, true); });
      fs.readFileSync(pm2._conf.PM2_LOG_FILE_PATH, 'utf8').should.not.containEql(daemonMarker);
      done();
    });
  });

  it('flush only selected app logs with the existing callback API', function(done) {
    pm2.flush('flush-target', function(err) {
      should(err).be.null();
      checkTarget(true, true, true);
      done();
    });
  });

  ['out', 'err'].forEach(function(stream) {
    it('flush only ' + stream + ' with the optional API argument', function(done) {
      pm2.flush('flush-target', function(err, list) {
        should(err).be.null();
        list.length.should.eql(procs.length);
        checkTarget(stream === 'out', stream === 'err', false);
        done();
      }, stream);
    });

    it('CLI flush --' + stream + ' selects custom paths for all matching cluster workers', function(done) {
      flushCLI(['flush-target', '--' + stream], function(stdout) {
        checkTarget(stream === 'out', stream === 'err', false);
        stdout.should.containEql(target[0]['pm_' + stream + '_log_path']);
        stdout.should.not.containEql(target[0]['pm_' + (stream === 'out' ? 'err' : 'out') + '_log_path']);
        stdout.should.not.containEql(target[0].pm_log_path);
        done();
      });
    });

    it('CLI flush --' + stream + ' without a selector preserves combined and daemon logs', function(done) {
      flushCLI(['--' + stream], function() {
        target.concat([other]).concat(merged).forEach(function(proc) {
          checkLogs(proc, stream === 'out', stream === 'err', false);
        });
        checkLogs(shared, true, true, false);
        fs.readFileSync(pm2._conf.PM2_LOG_FILE_PATH, 'utf8').should.containEql(daemonMarker);
        done();
      });
    });

    it('CLI flush --' + stream + ' truncates a file shared by stdout and stderr', function(done) {
      flushCLI(['flush-shared', '--' + stream], function() {
        checkLogs(shared, true, true, false);
        checkTarget(false, false, false);
        done();
      });
    });
  });

  it('CLI flush with no flags clears both streams, combined logs and daemon logs', function(done) {
    flushCLI([], function() {
      procs.forEach(function(proc) { checkLogs(proc, true, true, true); });
      fs.readFileSync(pm2._conf.PM2_LOG_FILE_PATH, 'utf8').should.not.containEql(daemonMarker);
      done();
    });
  });

  it('CLI flush with an app and no flags clears both streams and combined logs', function(done) {
    flushCLI(['flush-target'], function() {
      checkTarget(true, true, true);
      done();
    });
  });

  [['--out', '--err'], ['--err', '--out']].forEach(function(flags) {
    it('CLI flush ' + flags.join(' ') + ' gives stderr precedence like logs', function(done) {
      flushCLI(['flush-target'].concat(flags), function() {
        checkTarget(false, true, false);
        done();
      });
    });
  });

  it('CLI flush selects a single process ID', function(done) {
    flushCLI([String(target[0].pm_id), '--out'], function() {
      checkLogs(target[0], true, false, false);
      checkLogs(target[1], false, false, false);
      checkLogs(other, false, false, false);
      done();
    });
  });

  it('flush accepts a numeric process ID with the existing callback API', function(done) {
    pm2.flush(target[0].pm_id, function(err) {
      should(err).be.null();
      checkLogs(target[0], true, true, true);
      checkLogs(target[1], false, false, false);
      checkLogs(other, false, false, false);
      done();
    });
  });

  it('CLI flush handles logs merged across cluster workers', function(done) {
    flushCLI(['flush-merged', '--err'], function() {
      merged.forEach(function(proc) { checkLogs(proc, false, true, false); });
      checkTarget(false, false, false);
      done();
    });
  });

  it('CLI flush leaves other logs untouched for an unknown app', function(done) {
    flushCLI(['missing-app', '--out'], function() {
      procs.forEach(function(proc) { checkLogs(proc, false, false, false); });
      done();
    });
  });

  it('CLI flush by app still skips missing selected log files', function(done) {
    fs.unlinkSync(target[0].pm_out_log_path);
    flushCLI(['flush-target', '--out'], function() {
      fs.existsSync(target[0].pm_out_log_path).should.be.false();
      fs.readFileSync(target[0].pm_err_log_path, 'utf8').should.eql(contents);
      checkLogs(target[1], true, false, false);
      done();
    });
  });

  it('CLI flush without a selector still creates missing selected log files', function(done) {
    fs.unlinkSync(target[0].pm_out_log_path);
    flushCLI(['--out'], function() {
      checkLogs(target[0], true, false, false);
      done();
    });
  });

  it('CLI flush does not create missing unselected log files', function(done) {
    fs.unlinkSync(target[0].pm_err_log_path);
    flushCLI(['--out'], function() {
      fs.existsSync(target[0].pm_err_log_path).should.be.false();
      fs.readFileSync(target[0].pm_out_log_path, 'utf8').should.be.empty();
      done();
    });
  });
});
