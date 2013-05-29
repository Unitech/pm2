

var God = require('..');
var numCPUs = require('os').cpus().length;
var fs = require('fs');
var path = require('path');

describe('God', function() {
  it('should have right properties', function() {
    God.should.have.property('prepare');
    God.should.have.property('getProcesses');
    God.should.have.property('getMonitorData');
    God.should.have.property('getFormatedProcesses');
    God.should.have.property('checkProcess');
    God.should.have.property('stopAll');
    God.should.have.property('stopProcessId');
  });

  describe('One process', function() {
    var proc;

    after(function(done) {
      God.stopAll(done);
    });

    it('should fork one process', function(done) {
      God.prepare({
	pm_exec_path : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
	pm_err_log_path : path.resolve(process.cwd(), 'test/logpid/echoErr.log'),
	pm_out_log_path : path.resolve(process.cwd(), 'test/logpid/echoLog.log'),
	pm_pid_file : path.resolve(process.cwd(), 'test/logpid/echopid')
      }, function(err, proce) {
	   proc = proce;
	   proc.status.should.be.equal('online');
	   God.getFormatedProcesses().length.should.equal(1);
	   done();
	 });
    });

    it('should stop process and no more present', function(done) {
      proc.status.should.be.equal('online');
      God.checkProcess(proc.process.pid).should.be.true;
      God.stopProcess(proc, function() {
	God.getFormatedProcesses().length.should.equal(0);
	God.checkProcess(proc.process.pid).should.be.false;
	proc.status.should.be.equal('stopped');
	done()
      });
    });

    // Process stopped are not anymore cached in db
    it.skip('should start the process', function(done) {
      God.startProcess(proc, function(err, proc) {
        God.checkProcess(proc.process.pid).should.be.true;
	proc.status.should.be.equal('online');
	God.getFormatedProcesses().length.should.equal(1);
	done();
      });
    });
  });

  describe('Multi launching', function() {
    it('should launch multiple processes depending on CPUs available', function(done) {
      God.prepare({
        pm_exec_path : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/logpid/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/logpid/outLog.log'),
        pm_pid_path : path.resolve(process.cwd(), 'test/logpid/child'),
        instances : 3
      }, function(err, procs) {
	   God.getFormatedProcesses().length.should.equal(3);
           procs.length.should.equal(3);
	   done();
         });
    });
  });

});
