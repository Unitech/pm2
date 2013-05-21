
var God = require('..');

describe('God', function() {
    it('should have right properties', function() {
        God.should.have.property('prepare');
	God.should.have.property('getProcesses');
	God.should.have.property('getMonitorData');
	God.should.have.property('getFormatedProcesses');
	God.should.have.property('checkProcess');
	God.should.have.property('stopAll');
    });

    describe('One process', function() {
	var proc;

	after(function(done) {
	    God.stopAll(done);
	});
	
	it('should fork one process', function(done) {
	    God.prepare({
		script : './test/fixtures/echo.js',
		fileError : 'logs/echoErr.log',
		fileOutput : 'logs/echoLog.log',
		pidFile : 'pids/child'
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
	    proc.stop(function() {
		God.getFormatedProcesses().length.should.equal(1);
		God.checkProcess(proc.process.pid).should.be.false;
		proc.status.should.be.equal('stopped');
		done()		
	    });
	});

	it.skip('should start the process', function(done) {
	    proc.start(function(err, proc) {
		God.checkProcess(proc.process.pid).should.be.true;
		proc.status.should.be.equal('online');
		console.log(God.getFormatedProcesses());
		God.getFormatedProcesses().length.should.equal(1);
		done();
	    });	
	});
    });

    describe('Multi launching', function() {
	it('should launch multiple processes', function(done) {
            God.prepare({
		script : './test/fixtures/child.js',
		fileError : 'logs/errLog.log',
		fileOutput : 'logs/outLog.log',
		pidFile : 'pids/child',
		instances : 'max'
	    }, function(err, procs) {
		God.getFormatedProcesses().length.should.equal(5);
		done();
	    });
	    
	}); 
    });

});
