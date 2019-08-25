
/**
 * PM2 programmatic API tests
 */

//process.env.NODE_ENV ='test';
var PM2    = require('../..');
var should = require('should');
var path   = require('path');

describe('PM2 programmatic calls', function() {
  var proc1 = null;
  var procs = [];
  var bus   = null;

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      // clean dump file
      pm2.clearDump(function(err) {
        pm2.kill(done);
      });
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.launchBus(function(err, _bus) {
        bus = _bus;
        pm2.delete('all', function(err, ret) {
          done();
        });
      });
    });
  });

  describe('General methods', function() {
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

    it('should get id', function(done) {
      pm2.getProcessIdByName('child', function(err, data) {
        data[0].should.eql(0);
        should(err).be.null()
        setTimeout(done, 300);
      });
    });

    it('should get node.js version application running', function(done) {
      pm2.describe('child', function(err, data) {
        should(err).be.null()
        data[0].pm2_env.node_version.should.eql(process.versions.node);
        done();
      });
    });

    it('should start a script and force to launch it', function(done) {
      pm2.start({
        script : './child.js',
        force : true,
        name : 'toto',
        instances : 1
      }, function(err, data) {
        should(err).be.null()
        data.length.should.eql(1);
        done();
      });
    });

    it('should start a script in a specified cwd', function(done) {
      var target_cwd = path.join(__dirname, '/../fixtures/');

      pm2.start({
        script : './cron.js',
        cwd: target_cwd,
        instances : 1
      }, function(err, data) {
        should(err).be.null();
        proc1 = data[0];
        proc1.pm2_env.cwd.should.eql(target_cwd);
        should(err).be.null()
        done();
      });
    });

    it('should notice error if wrong file passed', function(done) {
      pm2.start('./UNKNOWN_SCRIPT.js', {
        force : true,
        name : 'tota',
        instances : 3
      }, function(err, data) {
        should.exists(err);
        done();
      });
    });

    it('should start a script and force to launch it', function(done) {
      pm2.start('./child.js', {
        force : true,
        name : 'tota',
        instances : 6
      }, function(err, data) {
        should(err).be.null()
        data.length.should.eql(6);
        done();
      });
    });

    it('should get pm2 version', function(done) {
      pm2.getVersion(function(err, data) {
        should(err).be.null()
        should.exists(data);
        done();
      });
    });

    it('should list processes', function(done) {
      pm2.list(function(err, ret) {
        should(err).be.null()
        ret.length.should.eql(9);
        done();
      });
    });

    it('should delete one process', function(done) {
      pm2.delete(proc1.pm2_env.pm_id, function(err, ret) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(8);
          done();
        });
      });
    });

    it('should save/dump all processes', function(done) {
      pm2.dump(function(err, ret) {
        should(err).be.null()
        done();
      });
    });

    it('should delete processes', function(done) {
      pm2.delete('all', function(err, ret) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(0);
          done();
        });
      });
    });

    it('should resurrect processes', function(done) {
      pm2.resurrect(function(err, ret) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(8);
          done();
        });
      });
    });

    it('should ping pm2', function(done) {
      pm2.ping(function(err, ret) {
        should(err).be.null()
        done();
      });
    });

    it('should reload all', function(done) {
      pm2.reload('all', function(err, ret) {
        should(err).be.null()
        done();
      });
    });

    it('should reload only one application', function(done) {
      pm2.reload('tota', function(err, ret) {
        should(err).be.null()
        pm2.describe('tota', function(err, proc) {
          should(err).be.null()
          procs = proc;
          proc[0].pm2_env.restart_time.should.eql(2);
          done();
        });
      });
    });

    it('should describe all process with name', function(done) {
      pm2.describe('tota', function(err, proc) {
        should(err).be.null()
        proc.length.should.eql(6);
        done();
      });
    });
  });

  describe('Restart methods', function() {
    it('should restart all', function(done) {
      pm2.restart('all', function(err, ret) {
        should(err).be.null()
        pm2.describe('tota', function(err, proc) {
          should(err).be.null()
          proc.length.should.eql(6);
          proc[0].pm2_env.restart_time.should.eql(3);
          done();
        });
      });
    });

    it('should restart process by name', function(done) {
      pm2.restart('tota', function(err, ret) {
        should(err).be.null()
        pm2.describe('tota', function(err, proc) {
          should(err).be.null()
          proc.length.should.eql(6);
          proc[0].pm2_env.restart_time.should.eql(4);
          done();
        });
      });
    });

    it('should restart process by id', function(done) {
      pm2.restart(procs[0].pm2_env.pm_id, function(err, ret) {
        should(err).be.null()
        pm2.describe(procs[0].pm2_env.pm_id, function(err, proc) {
          should(err).be.null()
          proc.length.should.eql(1);
          proc[0].pm2_env.restart_time.should.eql(5);
          done();
        });
      });
    });
  });

  describe('Stop methods', function() {
    it('should stop process name', function(done) {
      pm2.stop(procs[0].pm2_env.name, function(err, ret) {
        should(err).be.null()
        pm2.describe(procs[0].pm2_env.name, function(err, procs) {
          should(err).be.null()
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });

    it('should stop process id', function(done) {
      pm2.stop(procs[1].pm2_env.pm_id, function(err, ret) {
        should(err).be.null()
        pm2.describe(procs[1].pm2_env.pm_id, function(err, procs) {
          should(err).be.null()
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });

    it('should stop process all', function(done) {
      pm2.stop('all', function(err, ret) {
        should(err).be.null()
        pm2.describe(procs[0].pm2_env.pm_id, function(err, procs) {
          should(err).be.null()
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });
  });

  describe('start OR restart', function() {
    beforeEach(function(done) {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should start a JSON object in cluster mode', function(done) {
      pm2.start({
        script : './echo.js',
        instances : 4,
        exec_mode : 'cluster'
      }, function(err, dt) {
        should(err).be.null()

        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(4);
          ret[0].pm2_env.exec_mode.should.eql('cluster_mode');
          done();
        });
      });
    });

    it('should start a JSON object in fork mode', function(done) {
      pm2.start({
        script : './echo.js',
        instances : 4,
        exec_mode : 'fork'
      }, function(err, dt) {
        should(err).be.null()

        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(4);
          ret[0].pm2_env.exec_mode.should.eql('fork_mode');
          done();
        });
      });
    });

    it('should start a JSON file', function(done) {
      pm2.start('./all2.json', function(err, dt) {
        should(err).be.null()

        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(4);
          done();
        });
      });
    });
  });


  describe('start OR restart', function() {
    before(function(done) {
      pm2.delete('all', function(err, ret) {
        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(0);
          done();
        });
      });
    });

    it('should start', function(done) {
      pm2._startJson('./all2.json', {}, 'restartProcessId', function(err, data) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null()
          ret.length.should.eql(4);
          done();
        });
      });
    });

    it('should NOW restart action', function(done) {
      pm2._startJson('./all2.json', {}, 'restartProcessId', function(err, data) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null()

          ret.forEach(function(app) {
            app.pm2_env.restart_time.should.eql(1);
          });
          done();
        });
      });
    });

    it('should reset status', function(done) {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should start with specific environment variables depending on the env type', function(done) {
      pm2._startJson('../fixtures/all2.json', {
        env : 'production'
      }, 'restartProcessId', function(err, data) {
        should(err).be.null()
        pm2.list(function(err, ret) {
          should(err).be.null();
          ret[0].pm2_env['NODE_ENV'].should.eql('production');
          ret[0].pm2_env['TOTO'].should.eql('heymoto');
          done();
        });
      });
    });

  });

  describe('Connect / Disconnect', function() {
    it('should disconnect', function() {
      pm2.disconnect();
    });

    it('should connect', function(done) {
      pm2.connect(function() {
        done();
      });
    });

    it('should disconnect with callback', function(done) {
      pm2.disconnect(function() {
        done();
      });
    });

    it('should connect', function(done) {
      pm2.connect(function() {
        done();
      });
    });
  });

});
