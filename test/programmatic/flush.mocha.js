process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var fs     = require('fs');
var path   = require('path');

describe('Programmatic flush feature test', function() {
  var proc1 = null;
  var procs = [];

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  before(function(done) {
    pm2.delete('all', function() {
      done();
    });
  });

  after(function(done) {
    pm2.disconnect(done);
  });

  afterEach(function(done) {
    pm2.delete('all', done);
  });

  describe('Flush test', function() {
    it('flush all logs', function(done) {
      pm2.start({
        script: './echo.js',
        error_file : 'error-echo.log',
        out_file   : 'out-echo.log',
        merge_logs: false
      }, function(err, procs) {
        should(err).be.null();
        
        var out_file = procs[0].pm2_env.pm_out_log_path;
        var err_file = procs[0].pm2_env.pm_err_log_path;
        out_file.should.containEql('out-echo-0.log');
        err_file.should.containEql('error-echo-0.log');
        pm2.flush(undefined, function(){
          fs.readFileSync(out_file, "utf8").should.be.empty();
          fs.readFileSync(err_file, "utf8").should.be.empty();
          done();
        });
      });
    });
    it('flush only echo logs', function(done) {
      pm2.start({
        script: './echo.js',
        error_file : 'error-echo.log',
        out_file   : 'out-echo.log',
        merge_logs: false
      }, function(err, procs) {
        should(err).be.null();
        var out_file = procs[0].pm2_env.pm_out_log_path;
        var err_file = procs[0].pm2_env.pm_err_log_path;
        pm2.start({
            script: './001-test.js',
            error_file : 'error-001-test.log',
            out_file   : 'out-001-test.log',
            merge_logs: false
          }, function(err, procs, $out_file, $err_file) {
            should(err).be.null();
            var out_file1 = procs[0].pm2_env.pm_out_log_path;
            var err_file1 = procs[0].pm2_env.pm_err_log_path;
            pm2.flush('echo', function(){
              fs.readFileSync(out_file, "utf8").toString().should.be.empty();
              fs.readFileSync(err_file, "utf8").toString().should.be.empty();
              fs.readFileSync(out_file1, "utf8").toString().should.not.be.empty();
              fs.readFileSync(err_file1, "utf8").toString().should.not.be.empty();
              done();
        });
        });
      });
    });
  });
});