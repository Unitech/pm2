
process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var Plan   = require('../helpers/plan.js');

process.chdir(__dirname);

describe('Cluster programmatic tests', function() {
  var pm2 = new PM2.custom({
    cwd : '../fixtures'
  });

  after(function(done) {
    pm2.kill(done)
  });

  describe('Start with different instances number parameter', function() {

    afterEach(function(done) {
      pm2.delete('all', done);
    });

    it('should start 4 processes', function(done) {
      pm2.start({
        script    : './echo.js',
        instances : 4
      }, function(err, data) {
        should(err).be.null();

        pm2.list(function(err, ret) {
          should(err).be.null();
          ret.length.should.eql(4);
          done();
        });
      });
    });
  });

  describe('Action methods', function() {
    before(function(done) {
      pm2.start({
        script    : '../fixtures/child.js',
        instances : 4
      }, done);
    });

    it('should RESTART all apps', function(done) {
      pm2.restart('all', function(err, data) {
        should(err).be.null();

        pm2.list(function(err, procs) {
          should(err).be.null();
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(1);
          });
          done();
        });
      });
    });

    it('should RELOAD all apps', function(done) {
      pm2.reload('all', function(err, data) {
        should(err).be.null();

        pm2.list(function(err, procs) {
          should(err).be.null();
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(2);
          });
          done();
        });
      });
    });

    it('should GRACEFUL RELOAD all apps', function(done) {
      pm2.reload('all', function(err, data) {
        should(err).be.null();

        pm2.list(function(err, procs) {
          should(err).be.null();
          procs.length.should.eql(4);
          procs.forEach(function(proc) {
            proc.pm2_env.restart_time.should.eql(3);
          });
          done();
        });
      });
    });
  });

  describe('Scaling feature', function() {
    after(function(done) {
      pm2.delete('all', done);
    });

    before(function(done) {
      pm2.delete('all', function() {
        pm2.start({
          script    : '../fixtures/child.js',
          instances : 4,
          name      : 'child'
        }, done);
      });
    });

    it('should scale up application to 8', function(done) {
      pm2.scale('child', 8, function(err, procs) {
        should(err).be.null();

        pm2.list(function(err, procs) {
          should(err).be.null();
          procs.length.should.eql(8);
          done();
        });
      });
    });

    it('should scale down application to 2', function(done) {
      pm2.scale('child', 2, function(err, procs) {
        should(err).be.null();

        pm2.list(function(err, procs) {
          should(err).be.null();
          procs.length.should.eql(2);
          done();
        });
      });
    });

    it('should do nothing', function(done) {
      pm2.scale('child', 2, function(err, procs) {
        should(err).not.be.null();
        done();
      });
    });
  });

  describe('Listen timeout feature', function() {
    after(function(done) {
      pm2.delete('all', done);
    });

    it('should start script with 1000ms listen timeout', function(done) {
      pm2.start({
        script    : './echo.js',
        listen_timeout : 1000,
        exec_mode: 'cluster',
        instances : 1,
        name      : 'echo'
      }, done);
    });

    it('should have listen timeout updated', function(done) {
      pm2.list(function(err, list) {
        should(list[0].pm2_env.listen_timeout).eql(1000);
        should(list.length).eql(1);
        done();
      });
    });

    it('should take listen_timeout into account', function(done) {
      var called = false;
      var plan = new Plan(3, done);

      setTimeout(function() {
        should(called).be.false();
        plan.ok(true);
      }, 800);

      setTimeout(function() {
        should(called).be.true();
        plan.ok(true);
      }, 1500);

      pm2.reload('all', function(err, data) {
        called = true;
        plan.ok(true);
      });
    });

    it('should restart script with different listen timeout', function(done) {
      pm2.restart({
        script    : './echo.js',
        listen_timeout : 100,
        instances : 1,
        name      : 'echo'
      }, done);
    });

    it('should have listen timeout updated', function(done) {
      pm2.list(function(err, list) {
        should(list[0].pm2_env.listen_timeout).eql(100);
        should(list.length).eql(1);
        done();
      });
    });

    it('should be reloaded after 100ms', function(done) {
      var called = false;

      setTimeout(function() {
        should(called).be.true();
        done();
      }, 500);

      pm2.reload('all', function(err, data) {
        called = true;
      });
    });
  });

  describe('Kill timeout feature', function() {
    after(function(done) {
      pm2.delete('all', done);
    });

    it('should start script with 1000ms listen timeout', function(done) {
      pm2.start({
        script    : './cluster/sigint_catcher.js',
        kill_timeout : 1000,
        instances : 1,
        name      : 'sigint'
      }, done);
    });

    it('should have listen timeout updated', function(done) {
      pm2.list(function(err, list) {
        should(list[0].pm2_env.kill_timeout).eql(1000);
        should(list.length).eql(1);
        done();
      });
    });

    it('should script not be killed before kill timeout', function(done) {
      var called = false;

      setTimeout(function() {
        should(called).be.false();
      }, 800);

      pm2.reload('sigint', function() {
        called = true;
        done();
      });
    });

  });

});
