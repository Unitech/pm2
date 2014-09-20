
var should = require('should');
var assert = require('better-assert');
var path = require('path');
var pm2  = require('../..');

var Satan = require('../../lib/Satan');

describe('Satan', function() {

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.disconnect(done);
    });
  });

  it('should start Satan interaction', function(done) {
    Satan.start(function(err) {
      should(err).be.null;
      done();
    });
  });

  it('should auto instancy itself, fire event and kill daemon', function(done) {
    Satan = require('../../lib/Satan');
    Satan.start();
    process.once('satan:client:ready', function() {
      console.log('Client ready');
      done();
    });
  });

  it('should have right properties', function() {
    Satan.should.have.property('remoteWrapper');
    Satan.should.have.property('start');
    Satan.should.have.property('launchRPC');
    Satan.should.have.property('executeRemote');
    Satan.should.have.property('launchDaemon');
    Satan.should.have.property('getExposedMethods');
    Satan.should.have.property('pingDaemon');
    Satan.should.have.property('killDaemon');
  });


  describe('DAEMON', function() {
    it.skip('should have the right exposed methods via RPC', function(done) {
      Satan.getExposedMethods(function(err, methods) {
        assert(err == null);
        methods.should.have.property('prepare');
        methods.should.have.property('getMonitorData');
        methods.should.have.property('getSystemData');
        methods.should.have.property('stopProcessId');
        methods.should.have.property('stopAll');
        methods.should.have.property('stopProcessName');
        methods.should.have.property('killMe');
        done();
      });
    });

    it('should get an empty process list', function(done) {
      Satan.executeRemote('getMonitorData', {}, function(err, res) {
        assert(res.length === 0);
        done();
      });
    });

    it('should get an empty process list from system data', function(done) {
      Satan.executeRemote('getSystemData', {}, function(err, res) {
        assert(res.processes.length === 0);
        done();
      });
    });


    it('should launch a process', function(done) {
      Satan.executeRemote('prepare', {
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        name : 'toto',
        exec_mode : 'cluster_mode',
        instances       : 4
      }, function(err, procs) {
        assert(err == null);
        assert(procs.length == 4);
        done();
      });
    });

    it('should list 4 processes', function(done) {
      Satan.executeRemote('getMonitorData', {}, function(err, res) {
        assert(res.length === 4);
        done();
      });
    });

    it('should list 4 processes via system data', function(done) {
      Satan.executeRemote('getSystemData', {}, function(err, res) {
        assert(res.processes.length === 4);
        done();
      });
    });
  });
});
