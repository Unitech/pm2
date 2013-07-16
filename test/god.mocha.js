

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

  describe('Special functions for God', function() {
    it('should kill a process by name', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 2
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(2);

        God.stopProcessName('echo.js', function() {
          God.getFormatedProcesses().length.should.equal(0);
          God.stopAll(done);
        });
      });
    }); 
  });

  describe('One process', function() {
    var proc, pid;

    before(function(done) {
      God.stopAll(done);
    });
    
    after(function(done) {
      God.stopAll(done);
    });

    it('should fork one process', function(done) {
      God.prepare({
	pm_exec_path : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
	pm_err_log_path : path.resolve(process.cwd(), 'test/echoErr.log'),
	pm_out_log_path : path.resolve(process.cwd(), 'test/echoLog.log'),
	pm_pid_file : path.resolve(process.cwd(), 'test/echopid')
      }, function(err, proce) {
	proc = proce;
        pid = proc.process.pid;
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
	God.checkProcess(pid).should.be.false;
	done();
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
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 3
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(3);
        procs.length.should.equal(3);
        God.stopAll(done);
      });
    });

    it('should start maximum processes depending on CPU numbers', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 10
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(10);
        procs.length.should.equal(10);
        God.stopAll(done);
      });
    });

    it('should handle arguments', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/args.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        args            : "['-d', '-a']",
        instances       : '1'
      }, function(err, procs) {
        setTimeout(function() {
          God.getFormatedProcesses()[0].opts.restart_time.should.eql(0);
          console.log(God.getFormatedProcesses()[0]);
          God.stopAll(done);
        }, 500);
      });
    });
    
    it('should cron restart', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/args.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        args            : "['-d', '-a']",
        cron_restart    : '* * * * * *',
        instances       : '1'
      }, function(err, procs) {
        setTimeout(function() {
          God.getFormatedProcesses()[0].opts.restart_time.should.be.above(1);
          God.stopAll(done);
        }, 2200);
      });
    });
  });


});
