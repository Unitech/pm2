
process.chdir(__dirname);

var PM2 = require('../..');
var should = require('should');

describe('API checks', function() {
  describe('PM2 API case#1', function() {
    before(function(done) {
      PM2.delete('all', function() { done() });
    });

    after(function(done) {
      PM2.kill(done);
    });

    it('should instanciate a new pm2 with old api', function() {
      should.exists(PM2.pm2_home);
      should(PM2.daemon_mode).be.true();
      PM2.cwd.should.eql(process.cwd());
      should.exists(PM2.Client);
    });

    it('should connect to PM2', function(done) {
      PM2.connect(done);
    });

    it('should start a script', function(done) {
      PM2.start('./../fixtures/child.js', function(err) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(1);
          done();
        });
      });
    });

    it('should stop app by id', function(done) {
      PM2.stop(0, done);
    });

    it('should start app by id', function(done) {
      PM2.restart(0, done);
    });


    it('should fail if starting same script again', function(done) {
      PM2.start('./../fixtures/child.js', function(err) {
        should(err).not.be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(1);
          done();
        });
      });
    });

    it('should FORCE starting same script again', function(done) {
      PM2.start('./../fixtures/child.js', {force :true }, function(err) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(2);
          done();
        });
      });
    });

    it('should delete ALL', function(done) {
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

  describe('PM2 API case#2 (JSON style)', function() {
    before(function(done) {
      PM2.delete('all', function() { done() });
    });

    after(function(done) {
      PM2.kill(done);
    });

    it('should start script in cluster mode, 4 instances', function(done) {
      PM2.start({
        script : './../fixtures/child.js',
        instances : 4,
        name : 'http-test'
      }, function(err) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(4);
          done();
        });
      });
    });

    it('should stop app', function(done) {
      PM2.stop('http-test', function(err, procs) {
        should(err).be.null();
        procs.length.should.eql(4);
        PM2.list(function(err, list) {
          should(list.length).eql(4);
          list.forEach(function(proc) {
            proc.pm2_env.status.should.eql('stopped');
          });
          done();
        });
      });
    });

    it('should restart all apps', function(done) {
      PM2.restart('http-test', function(err, procs) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(list.length).eql(4);
          list.forEach(function(proc) {
            proc.pm2_env.status.should.eql('online');
          });
          done();
        });
      });
    });
  });

  describe('Should keep environment variables', function() {
    it('should start app with treekill', function(done) {
      PM2.start({
        script : './../fixtures/child.js',
        instances : 1,
        treekill : false,
        name : 'http-test'
      }, function(err) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(1);
          should(list[0].pm2_env.treekill).be.false;
          done();
        });
      });
    });

    it('should restart app and treekill still at false', function(done) {
      PM2.restart('http-test', function() {
        PM2.list(function(err, list) {
          should(err).be.null();
          should(list.length).eql(1);
          should(list[0].pm2_env.treekill).be.false;
          done();
        });
      });
    });

  });

  describe('Issue #2337', function() {
    before(function(done) {
      PM2.delete('all', function() { done() });
    });

    after(function(done) {
      PM2.kill(done);
    });

    it('should start two app with same name', function(done) {
      PM2.start({
        script : './../fixtures/child.js',
        instances : 2,
        exec_mode : 'fork',
        name : 'http-test'
      }, function(err) {
        should(err).be.null();
        PM2.list(function(err, list) {
          should(err).be.null();
          list.forEach(function(proc) {
            proc.pm2_env.exec_mode.should.eql('fork_mode');
          });
          should(list.length).eql(2);
          done();
        });
      });
    });

    it('should stop first app', function(done) {
      PM2.stop(0, done);
    });

    it('should force start a 3rd script', function(done) {
      PM2.start('./../fixtures/child.js', {
        force : true,
        name : 'toto'
      }, function() {
        PM2.list(function(err, list) {
          list.length.should.eql(3);
          done();
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
      should.exists(PM2.pm2_home);
      should(PM2.daemon_mode).be.true();
      PM2.cwd.should.eql(process.cwd());
      should.exists(PM2.Client);
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
      pm2.kill(done);
    });

    it('should create new custom PM2 instance', function() {
      pm2 = new PM2.custom({
        daemon_mode : true
      });
      should.exists(pm2.pm2_home);
      should(pm2.daemon_mode).be.true();
      pm2.cwd.should.eql(process.cwd());
      should.exists(pm2.Client);
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

  describe('Should start pm2 in do daemon mode', function() {
    var pm2;

    after(function(done) {
      pm2.kill(done);
    });

    it('should create new custom PM2 instance', function() {
      pm2 = new PM2.custom({
        daemon_mode : false
      });

      should.exists(pm2.pm2_home);
      should(pm2.daemon_mode).be.false();
      pm2.cwd.should.eql(process.cwd());
      should.exists(pm2.Client);
    });
  });

  describe('Launch modules', function() {
    var Modularizer = require('../../lib/API/Modules/Modularizer');
    var module = 'pm2-server-monit';

    after(function(done) {
      Modularizer.uninstall(PM2, module, done);
    });

    it('Should start up modules', function(done) {
      PM2.connect(true, function(err) {
        should(err).be.null();

        Modularizer.install(PM2, module, function() {
          PM2.stop(module, function() {
            should(err).be.null();

            PM2.launchModules(function(err) {
              should(err).be.null();

              PM2.list(function(err, list) {
                should(err).be.null();
                should(list[0].name).eql(module);
                should(list[0].pm2_env.status).eql('online');
                done();
              });
            });
          });
        });
      });
    });
  });

});
