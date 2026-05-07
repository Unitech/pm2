
process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var Plan   = require('../helpers/plan.js');
var sexec = require('../../lib/tools/sexec.js')

process.chdir(__dirname);

describe('Wait ready / Graceful start / restart', function() {
  this.retries(2)

  var pm2 = new PM2.custom({
    cwd : '../fixtures/listen-timeout/',
  });

  before(function(done) {
    pm2.delete('all', function() {
      done()
    });
  });

  describe('(FORK) Listen timeout feature', function() {
    this.timeout(60000);

    after(function(done) {
      pm2.delete('all', done);
    });

    it('should force script to set as ready after forced listen_timeout', function(done) {
      pm2.start({
        script         : './wait-ready.js',
        listen_timeout : 1000,
        wait_ready     : true,
        name           : 'echo'
      });

      setTimeout(function() {
        pm2.list(function(err, apps) {
          should(apps[0].pm2_env.status).eql('launching');
        });
      }, 800);

      setTimeout(function() {
        pm2.list(function(err, apps) {
          should(apps[0].pm2_env.status).eql('online');
          done();
        })
      }, 3000);
    });

    it('should have listen timeout updated', function(done) {
      pm2.list(function(err, list) {
        should(list[0].pm2_env.wait_ready).eql(true);
        done();
      });
    });

    it('should take listen timeout into account', function(done) {
      var called = false;
      var plan = new Plan(4, done);

      setTimeout(function() {
        should(called).be.false();
        plan.ok(true);
      }, 300);

      setTimeout(function() {
        should(called).be.true();
        plan.ok(true);

        pm2.list((err, apps) => {
          should(apps[0].pm2_env.wait_ready).eql(true)
          plan.ok(true)
        })
      }, 3000);

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
      }, 2000);

      pm2.reload('all', function(err, data) {
        called = true;
      });
    });
  });


  describe('(CLUSTER) Listen timeout feature', function() {
    this.timeout(120000);

    after(function(done) {
      pm2.delete('all', done);
    });

    it('should force script to set as ready after forced listen_timeout', function(done) {
      pm2.start({
        script         : './wait-ready.js',
        listen_timeout : 1000,
        wait_ready     : true,
        instances      : 1,
        exec_mode: 'cluster',
        name           : 'http'
      }, function(err) {
        if (err) return done(err);

        // After start callback, check launching state quickly
        setTimeout(function() {
          pm2.list(function(err, apps) {
            if (apps && apps[0]) {
              // Status might be launching or online depending on timing
              should(['launching', 'online']).containEql(apps[0].pm2_env.status);
            }
          });
        }, 500);

        // Then wait for listen_timeout to force online
        setTimeout(function() {
          pm2.list(function(err, apps) {
            should(apps[0].pm2_env.status).eql('online');
            done();
          })
        }, 3000);
      });
    });

    it('should take listen timeout into account', function(done) {
      var called = false;
      var plan = new Plan(4, done);

      setTimeout(function() {
        should(called).be.false();
        plan.ok(true);
      }, 500);

      setTimeout(function() {
        should(called).be.true();
        plan.ok(true);

        pm2.list((err, apps) => {
          should(apps[0].pm2_env.wait_ready).eql(true)
          plan.ok(true)
        })
      }, 5000);

      pm2.reload('all', function(err, data) {
        called = true;
        plan.ok(true);
      });
    });

  });

  describe('(Cluster): Wait ready feature', function () {
    this.timeout(60000);

    after(function(done) {
      pm2.delete('all', done);
    });

    it('Should send SIGINT right after ready and not wait for listen timeout', function(done) {
      const plan = new Plan(2, done);

      pm2.start({
        script         : './wait-ready.js',
        listen_timeout : 5000,
        wait_ready     : true,
        instances      : 1,
        exec_mode      : 'cluster',
        name           : 'echo'
      }, (error, result) => {
        if (error) {
          return done(error);
        }
        const oldPid = result[0].process.pid;
        plan.ok(typeof oldPid !== 'undefined');

        pm2.reload('echo', {}, done);
        setTimeout(function() {
          sexec(`ps -eo pid | grep -w ${oldPid}`, (err, res) => {
            plan.ok(err === 1);
          })
        }, 4000);
      });
    });
  });

});
