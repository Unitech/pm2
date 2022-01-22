
//process.env.NODE_ENV ='test';
var PM2    = require('../..');
var should = require('should');

describe('PM2 programmatic calls', function() {
  var proc1 = null;
  var procs = [];
  var bus   = null;

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  after(function(done) {
    pm2.delete('all', function() {
      // clean dump file
      pm2.clearDump(function() {
        pm2.kill(done);
      });
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.launchBus(function(err, _bus) {
        bus = _bus;
        pm2.delete('all', function() {
          done();
        });
      });
    });
  });

  it('should start a script', function(done) {
    pm2.start({
      script : './child.js',
      name : 'child',
      instances : 1
    }, function(err, data) {
      proc1 = data[0];
      should(err).be.null()
      done();
    });
  });

  it('should save/dump all processes', function(done) {
    pm2.dump(function(err) {
      should(err).be.null()
      done();
    });
  });


  it('should delete processes', function(done) {
    pm2.delete('all', function(err) {
      should(err).be.null()
      pm2.list(function(err, ret) {
        should(err).be.null()
        ret.length.should.eql(0);
        done();
      });
    });
  });

  it('should not save/dump if 0 processes', function(done) {
    pm2.dump(function(err) {
      should(err).not.be.null()
      done();
    });
  });

  it('should save/dump if 0 processes AND --FORCE', function(done) {
    pm2.dump(true, function(err) {
      should(err).be.null()
      done();
    });
  });

  it('should resurrect 0 processes', function(done) {
    pm2.resurrect(function(err) {
      should(err).be.null()
      pm2.list(function(err, ret) {
        should(err).be.null()
        ret.length.should.eql(0);
        done();
      });
    });
  });

})
