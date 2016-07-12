
process.chdir(__dirname);

var PM2 = require('../..');
var should = require('should');

describe('Lazy API usage', function() {
  before(function(done) {
    PM2.delete('all', function() { done() } );
  });

  it('should start a script without passing any args', function(done) {
    PM2.start('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should list one process', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(1);
      done();
    });
  });

  it('should fail to start script', function(done) {
    PM2.start('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should list one process', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(1);
      done();
    });
  });


  it('should reload', function(done) {
    PM2.reload('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should process been restarted', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(1);
      procs[0].pm2_env.restart_time.should.eql(1);
      done();
    });
  });

  it('should restart', function(done) {
    PM2.restart('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should process been restarted', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(1);
      procs[0].pm2_env.restart_time.should.eql(2);
      done();
    });
  });

  it('should stop', function(done) {
    PM2.stop('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should process been stopped', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(1);
      procs[0].pm2_env.status.should.eql('stopped');
      done();
    });
  });

  it('should delete', function(done) {
    PM2.delete('./../fixtures/child.js');
    setTimeout(function() {
      done();
    }, 300);
  });

  it('should list 0 procs', function(done) {
    PM2.list(function(err, procs) {
      procs.length.should.eql(0);
      done();
    });
  });
});
