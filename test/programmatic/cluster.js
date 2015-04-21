


var pm2    = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('Cluster programmatic tests', function() {

  var proc1 = null;
  var procs = [];

  after(pm2.disconnect);

  before(function(done) {
    pm2.connect(function() {
      pm2.kill(function() {
        pm2.connect(function() {
          done();
        });
      });
    });
  });

  describe('Start with different instances number parameter', function() {

    afterEach(function(done) {
      pm2.delete('all', done);
    });

    it('should restart process based on memory limit (UGLY WAY)', function(done) {
      pm2.start({
        script    : 'test/fixtures/echo.js',
        instances : 4
      }, function(err, data) {
        should(err).be.null;

        pm2.list(function(err, ret) {
          should(err).be.null;
          ret.length.should.eql(4);
          done();
        });
      });
    });

    it('should restart process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script    : 'test/fixtures/echo.js',
        instances : 0
      }, function(err, data) {
        should(err).be.null;

        pm2.list(function(err, ret) {
          should(err).be.null;
          ret.length.should.eql(require('os').cpus().length);
          done();
        });
      });
    });

    it('should restart process based on memory limit (JSON WAY)', function(done) {
      pm2.start({
        script    : 'test/fixtures/echo.js',
        instances : -1
      }, function(err, data) {
        should(err).be.null;

        pm2.list(function(err, ret) {
          should(err).be.null;
          ret.length.should.eql(require('os').cpus().length - 1);
          done();
        });
      });
    });
  });

  describe('Test methods', function() {
    before(function(done) {
      pm2.start({
        script    : 'test/fixtures/child.js',
        instances : 4
      }, done);
    });

    it('should RESTART all apps', function(done) {
      pm2.restart('all', function(err, data) {
        should(err).be.null;

        pm2.list(function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(1);
          });
          done();
        });
      });
    });

    it('should RELOAD all apps', function(done) {
      pm2.reload('all', function(err, data) {
        should(err).be.null;

        pm2.list(function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(2);
          });
          done();
        });
      });
    });

    it('should GRACEFUL RELOAD all apps', function(done) {
      pm2.reload('all', function(err, data) {
        should(err).be.null;

        pm2.list(function(err, procs) {
          should(err).be.null;
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(3);
          });
          done();
        });
      });
    });
  });


});
