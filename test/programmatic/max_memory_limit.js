

var pm2    = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('Max memory restart programmatic', function() {

  var proc1 = null;
  var procs = [];

  after(pm2.disconnect);

  afterEach(function(done) {
    pm2.delete('all', function() {
      // Wait for process reloaded to exit themselves
      setTimeout(done, 300);
    });
  });

  before(function(done) {
    process.env.PM2_WORKER_INTERVAL = 1000;

    pm2.connect(function() {
      pm2.delete('all', function() {
        done();
      });
    });
  });

  describe('Max memory limit', function() {
    it('should restart process based on memory limit (UGLY WAY)', function(done) {
      pm2.start(process.cwd() + '/test/fixtures/json-reload/big-array.js', {
        maxMemoryRestart : '10M'
      }, function(err, data) {
        should(err).be.null;

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null;
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });

    it('should restart process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script : process.cwd() + '/test/fixtures/json-reload/big-array.js',
        max_memory_restart : '10M'
      }, function(err, data) {
        should(err).be.null;

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null;
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });

    it('should restart CLUSTER process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script : process.cwd() + '/test/fixtures/big-array-listen.js',
        max_memory_restart : '10M',
        exec_mode : 'cluster'
      }, function(err, data) {
        should(err).be.null;

        setTimeout(function() {
          pm2.list(function(err, ret) {
            should(err).be.null;
            ret[0].pm2_env.restart_time.should.not.eql(0);
            done();
          });
        }, 3000);
      });
    });


  });

});
