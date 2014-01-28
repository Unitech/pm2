
var Satan;
var should = require('should');
var assert = require('better-assert');
var path = require('path');

describe('Satan', function() {

  after(function(done) {
    Satan.killDaemon(function() {
      setTimeout(done, 400);
    });
  });

  it('should auto instancy itself, fire event and kill daemon', function(done) {
    Satan = require('../lib/Satan');
    Satan.start();
    process.once('satan:client:ready', function() {
      console.log('Client ready');
      Satan.killDaemon(function() {
        done();
      });
    });
  });

  it('should start daemon', function(done) {
    Satan.launchDaemon(function(err, child) {
      assert(err == null);
      assert(typeof child.pid == 'number');
      Satan.pingDaemon(function(online) {
        console.log(online);
        assert(online == true);
        done();
      });
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
    it('should have the right exposed methods via RPC', function(done) {
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
