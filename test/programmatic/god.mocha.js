
var God = require('../../lib/God');
var numCPUs = require('os').cpus().length;
var fs = require('fs');
var path = require('path');
var should = require('should');

/**
 * Description
 * @method getConf
 * @return AssignmentExpression
 */
function getConf() {
  return process_conf = {
    pm_exec_path : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
    pm_err_log_path : path.resolve(process.cwd(), 'test/echoErr.log'),
    pm_out_log_path : path.resolve(process.cwd(), 'test/echoLog.log'),
    pm_pid_file : path.resolve(process.cwd(), 'test/echopid'),
    exec_mode       : 'cluster_mode'
  };
}

describe('God', function() {
  before(function(done) {
    God.deleteAll({}, function(err, dt) {
      done();
    });
  });

  it('should have right properties', function() {
    God.should.have.property('prepare');
    God.should.have.property('ping');
    God.should.have.property('getProcesses');
    God.should.have.property('getMonitorData');
    God.should.have.property('getSystemData');
    God.should.have.property('getFormatedProcesses');
    God.should.have.property('checkProcess');
    God.should.have.property('stopAll');
    God.should.have.property('reloadLogs');
    God.should.have.property('stopProcessId');
    God.should.have.property('reload');
    God.should.have.property('reloadProcessName');
    God.should.have.property('sendSignalToProcessId');
    God.should.have.property('sendSignalToProcessName');
  });

  describe('Special functions for God', function() {
    before(function(done) {
      God.deleteAll({}, function(err, dt) {
        done();
      });
    });

    it('should kill a process by name', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 2
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(2);

        God.stopProcessName('echo', function() {
          God.getFormatedProcesses().length.should.equal(2);
          God.deleteAll({}, done);
        });
      });
    });
  });

  describe('One process', function() {
    var proc, pid;

    before(function(done) {
      God.deleteAll({}, function(err, dt) {
        done();
      });
    });

    it('should fork one process', function(done) {
      God.prepare(getConf(), function(err, procs) {
        should(err).be.null;
        pid = procs[0].pid;
	procs[0].pm2_env.status.should.be.equal('online');
	God.getFormatedProcesses().length.should.equal(1);
	done();
      });
    });
  });

  describe('Process State Machine', function() {
    var clu, pid;

    before(function(done) {
      God.deleteAll({}, function(err, dt) {
        done();
      });
    });
    it('should start a process', function(done) {
      God.prepare(getConf(), function(err, procs) {
        clu = procs[0];

        pid = clu.pid;
	procs[0].pm2_env.status.should.be.equal('online');
	done();
      });
    });

    it('should stop a process and keep in database on state stopped', function(done) {
      God.stopProcessId(clu.pm2_env.pm_id, function(err, dt) {
        var proc = God.findProcessById(clu.pm2_env.pm_id);
        proc.pm2_env.status.should.be.equal('stopped');
        God.checkProcess(proc.process.pid).should.be.equal(false);
        done();
      });
    });

    it('should restart the same process and set it as state online and be up', function(done) {
      God.restartProcessId(clu.pm2_env.pm_id, function(err, dt) {
        var proc = God.findProcessById(clu.pm2_env.pm_id);
        proc.pm2_env.status.should.be.equal('online');
        God.checkProcess(proc.process.pid).should.be.equal(true);
        done();
      });
    });

    it('should stop this process by name and keep in db on state stopped', function(done) {
      God.stopProcessName(clu.name, function(err, dt) {
        var proc = God.findProcessById(clu.pm2_env.pm_id);
        proc.pm2_env.status.should.be.equal('stopped');
        God.checkProcess(proc.process.pid).should.be.equal(false);
        done();
      });
    });

    it('should restart the same process by NAME and set it as state online and be up', function(done) {
      God.restartProcessName(clu.name, function(err, dt) {
        var proc = God.findProcessById(clu.pm2_env.pm_id);
        proc.pm2_env.status.should.be.equal('online');
        God.checkProcess(proc.process.pid).should.be.equal(true);
        done();
      });
    });

    it('should stop and delete a process id', function(done) {
      var old_pid = clu.pid;
      God.deleteProcessId(clu.pm2_env.pm_id, function(err, dt) {
        var proc = God.findProcessById(clu.pm2_env.pm_id);
        God.checkProcess(old_pid).should.be.equal(false);
        dt.length.should.be.equal(0);
        done();
      });
    });

    it('should start stop and delete the process name from database', function(done) {
      God.prepare(getConf(), function(err, _clu) {
        pid = _clu[0].pid;
	_clu[0].pm2_env.status.should.be.equal('online');
        var old_pid = _clu[0].pid;
        God.deleteProcessName(_clu.name, function(err, dt) {
          setTimeout(function() {
            var proc = God.findProcessById(clu.pm2_env.pm_id);
            should(proc == null);
            God.checkProcess(old_pid).should.be.equal(false);
            done();
          }, 100);
        });
      });
    });

  });


  describe('Reload - cluster', function() {

    before(function(done) {
      God.deleteAll({}, function(err, dt) {
        done();
      });
    });

    it('should launch app', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/child.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 4,
        exec_mode       : 'cluster_mode',
        name : 'child'
      }, function(err, procs) {
	var processes = God.getFormatedProcesses();

        setTimeout(function() {
          processes.length.should.equal(4);
          processes.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(0);
          });
          done();
        }, 100);
      });
    });

    it('should restart the same process and set it as state online and be up', function(done) {
      var processes = God.getFormatedProcesses();

      God.reload({}, function(err, dt) {
	var processes = God.getFormatedProcesses();

        processes.length.should.equal(4);
        processes.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(1);
        });
        done();
      });
    });

  });

  describe('Multi launching', function() {

    before(function(done) {
      God.deleteAll({}, function(err, dt) {
        setTimeout(done, 50);
      });
    });


    afterEach(function(done) {
      God.deleteAll({}, function(err, dt) {
        setTimeout(done, 50);
      });
    });

    it('should launch multiple processes depending on CPUs available', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        exec_mode : 'cluster_mode',
        instances       : 3
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(3);
        procs.length.should.equal(3);
        done();
      });
    });

    it('should start maximum processes depending on CPU numbers', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 10,
        exec_mode : 'cluster_mode',
      }, function(err, procs) {
	God.getFormatedProcesses().length.should.equal(10);
        procs.length.should.equal(10);
        done();
      });
    });

    it('should handle arguments', function(done) {
      God.prepare({
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/args.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        args            : "['-d', '-a']",
        instances       : '1',
        exec_mode : 'cluster_mode'
      }, function(err, procs) {
        setTimeout(function() {
          God.getFormatedProcesses()[0].pm2_env.restart_time.should.eql(0);
          done();
        }, 500);
      });
    });
  });

  it('should report pm2 version', function(done) {
    God.getVersion({}, function(err, version) {
      version.should.not.be.null;
      done();
    });
  });
});
