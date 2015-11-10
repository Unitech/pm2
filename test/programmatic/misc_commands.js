

var pm2    = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('Misc commands', function() {
  after(pm2.disconnect);

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function() {
        done();
      });
    });
  });

  it('should start 4 processes', function(done) {
    pm2.start({
      script    : 'test/fixtures/echo.js',
      instances : 4,
      name      : 'echo'
    }, function(err, data) {
      should(err).be.null;
      done();
    });
  });

  it('should restart them', function(done) {
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

  it('should fail when trying to reset metadatas of unknown process', function(done) {
    pm2.reset('allasd', function(err, data) {
      should(err).not.be.null;
      done();
    });
  });

  it('should reset their metadatas', function(done) {
    pm2.reset('all', function(err, data) {
      should(err).be.null;

      pm2.list(function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(4);
        procs.forEach(function(proc) {
          proc.pm2_env.restart_time.should.eql(0);
        });
        done();
      });
    });
  });

  it('should save process list', function(done) {
    pm2.dump(function(err, data) {
      should(err).be.null;
      done();
    });
  });

  it('should delete child processes', function(done) {
    pm2.delete('echo', function(err, data) {
      should(err).be.null;

      pm2.list(function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(0);
        done();
      });
    });
  });

  it('should resurrect previous processes', function(done) {
    pm2.resurrect(function(err, data) {
      should(err).be.null;

      pm2.list(function(err, procs) {
        should(err).be.null;
        procs.length.should.eql(4);
        done();
      });
    });
  });


});
