
process.env.NODE_ENV = 'test';
process.env.PM2_WORKER_INTERVAL = 1000;

var PM2    = require('../..');
var should = require('should');
var path   = require('path');

// Change to current folder

describe('Max memory restart programmatic', function() {
  var proc1 = null;
  var procs = [];
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures/json-reload/'
  });

  after(function(done) {
    pm2.kill(done)
  });

  afterEach(function(done) {
    pm2.delete('all', function() {
      setTimeout(done, 300);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      done();
    });
  });

  describe('Max memory limit', function() {
    it('should restart process based on memory limit (UGLY WAY)', function(done) {
      pm2.start('./big-array.js', {
        maxMemoryRestart : '10M'
      }, function(err, data) {
        should(err).be.null();

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null();
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });

    it('should restart process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script : './big-array.js',
        max_memory_restart : '10M'
      }, function(err, data) {
        should(err).be.null();

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null();
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });

    it('should restart CLUSTER process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script : './../big-array-listen.js',
        max_memory_restart : '10M',
        exec_mode : 'cluster'
      }, function(err, data) {
        should(err).be.null();

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null();
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });


  });

});
