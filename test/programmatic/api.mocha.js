
var PM2 = require('../..');
var should = require('should');

process.chdir(__dirname);

describe('API checks', function() {

  describe('PM2 connect old style', function() {
    before(function(done) {
      PM2.delete('all', function() { done() });
    });

    after(function(done) {
      PM2.kill(function() {
        setTimeout(done, 1000);
      });
    });

    it('should instanciate a new pm2 with old api', function() {
      should(PM2.pm2_home).exists;
      should(PM2.daemon_mode).be.true();
      PM2.cwd.should.eql(process.cwd());
      should(PM2.Client).exists;
    });

    it('should connect to PM2', function(done) {
      PM2.connect(done);
    });

    it('should be able to start a script', function(done) {
      PM2.start('./../fixtures/child.js', function(err) {
        should(err).be.null();
        done();
      });
    });

    it('should do random commands', function(done) {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);
        PM2.delete('all', function(err) {
          should(err).be.null();
          PM2.list(function(err, list) {
            should(err).be.null();
            should(list.length).eql(0);
            done();
          });
        });
      });
    });
  });

  describe('PM2 auto connect feature', function() {
    after(function(done) {
      PM2.kill(function() {
        done();
      });
    });

    it('should instanciate a new pm2 with old api', function() {
      should(PM2.pm2_home).exists;
      should(PM2.daemon_mode).be.true();
      PM2.cwd.should.eql(process.cwd());
      should(PM2.Client).exists;
    });

    it('should be able to start a script without connect', function(done) {
      PM2.start('./../fixtures/child.js', function(err) {
        should(err).be.null();
        done();
      });
    });

    it('should do random commands', function(done) {
      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);
        PM2.delete('all', function(err) {
          should(err).be.null();
          PM2.list(function(err, list) {
            should(err).be.null();
            should(list.length).eql(0);
            done();
          });
        });
      });
    });

  });

  describe('Custom PM2 instance', function() {
    var pm2;

    after(function(done) {
      pm2.destroy(done);
    });

    it('should create new custom PM2 instance', function() {
      pm2 = new PM2.custom({
        independent : true,
        daemon_mode : true
      });
      should(pm2.pm2_home).exists;
      should(pm2.daemon_mode).be.true();
      pm2.cwd.should.eql(process.cwd());
      should(pm2.Client).exists;
    });

    it('should be able to start a script without connect', function(done) {
      pm2.start('./../fixtures/child.js', function(err) {
        should(err).be.null();
        done();
      });
    });

    it('should do random commands', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);
        pm2.delete('all', function(err) {
          should(err).be.null();
          pm2.list(function(err, list) {
            should(err).be.null();
            should(list.length).eql(0);
            done();
          });
        });
      });
    });
  });


});
