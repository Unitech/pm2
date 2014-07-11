
/**
 * Test Satan in a programmatic way
 */

var pm2  = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

//process.env.PM2_SILENT = true;

describe('PM2 programmatic calls', function() {

  var proc1 = null;
  var procs = [];

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.disconnect(done);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      setTimeout(function() {
        pm2.delete('all', function(err, ret) {
          done();
        });
      }, 1000);
    });
  });

  it('should start a script', function(done) {
    pm2.start(process.cwd() + '/test/programmatic/child.js',
              {},
              function(err, data) {
      proc1 = data[0];

      should(err).be.null;
      done();
    });
  });

  it('should start a script and force to launch it', function(done) {
    pm2.start(process.cwd() + '/test/programmatic/child.js', {
      force : true,
      name : 'toto'
    }, function(err, data) {
      should(err).be.null;
      data.length.should.eql(1);
      done();
    });
  });

  it('should notice error if wrong file passed', function(done) {
    pm2.start(process.cwd() + '/child.js', {
      force : true,
      name : 'tota',
      instances : 3
    }, function(err, data) {
      should(err).exists;
      done();
    });
  });

  it('should start a script and force to launch it', function(done) {
    pm2.start(process.cwd() + '/test/programmatic/child.js', {
      force : true,
      name : 'tota',
      instances : 3
    }, function(err, data) {
      should(err).be.null;
      data.length.should.eql(3);
      done();
    });
  });

  it('should get pm2 version', function(done) {
    pm2.getVersion(function(err, data) {
      should(err).be.null;
      data.should.exists;
      done();
    });
  });

  it('should list processes', function(done) {
    pm2.list(function(err, ret) {
      should(err).be.null;
      ret.length.should.eql(5);
      done();
    });
  });

  it('should delete one process', function(done) {
    pm2.delete(proc1.pm2_env.pm_id, function(err, ret) {
      should(err).be.null;
      pm2.list(function(err, ret) {
        should(err).be.null;
        ret.length.should.eql(4);
        done();
      });
    });
  });

  it('should save all processes', function(done) {
    pm2.dump(function(err, ret) {
      should(err).be.null;
      done();
    });
  });

  it('should delete processes', function(done) {
    pm2.delete('all', function(err, ret) {
      should(err).be.null;
      ret.length.should.eql(0);
      pm2.list(function(err, ret) {
        should(err).be.null;
        ret.length.should.eql(0);
        done();
      });
    });
  });

  it('should resurrect processes', function(done) {
    pm2.resurrect(function(err, ret) {
      should(err).be.null;
      pm2.list(function(err, ret) {
        should(err).be.null;
        ret.length.should.eql(4);
        done();
      });
    });
  });

  it('should ping pm2', function(done) {
    pm2.ping(function(err, ret) {
      should(err).be.null;
      done();
    });
  });

  it('should launch pm2 web API', function(done) {
    pm2.web(function(err, ret) {
      should(err).be.null;
      pm2.list(function(err, ret) {
        should(err).be.null;
        ret.length.should.eql(5);
        done();
      });
    });
  });

  it('should reload all', function(done) {
    pm2.reload('all', function(err, ret) {
      should(err).be.null;
      done();
    });
  });

  it('should reload only on2', function(done) {
    pm2.reload('tota', function(err, ret) {
      should(err).be.null;
      pm2.describe('tota', function(err, proc) {
        should(err).be.null;
        procs = proc;
        proc.length.should.eql(3);
        proc[0].pm2_env.restart_time.should.eql(2);
        done();
      });
    });
  });

  it('should describe all process with name', function(done) {
    pm2.describe('tota', function(err, proc) {
      should(err).be.null;
      proc.length.should.eql(3);
      done();
    });
  });


  describe('Restart methods', function() {
    it('should restart all', function(done) {
      pm2.restart('all', function(err, ret) {
        should(err).be.null;
        pm2.describe('tota', function(err, proc) {
          should(err).be.null;
          proc.length.should.eql(3);
          proc[0].pm2_env.restart_time.should.eql(3);
          done();
        });
      });
    });

    it('should restart process by name', function(done) {
      pm2.restart('tota', function(err, ret) {
        should(err).be.null;
        pm2.describe('tota', function(err, proc) {
          should(err).be.null;
          proc.length.should.eql(3);
          proc[0].pm2_env.restart_time.should.eql(4);
          done();
        });
      });
    });

    it('should restart process by id', function(done) {
      pm2.restart(procs[0].pm2_env.pm_id, function(err, ret) {
        should(err).be.null;
        pm2.describe(procs[0].pm2_env.pm_id, function(err, proc) {
          should(err).be.null;
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
        should(err).be.null;
        pm2.describe(procs[0].pm2_env.name, function(err, procs) {
          should(err).be.null;
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });

    it('should stop process id', function(done) {
      pm2.stop(procs[1].pm2_env.pm_id, function(err, ret) {
        should(err).be.null;
        pm2.describe(procs[1].pm2_env.pm_id, function(err, procs) {
          should(err).be.null;
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });

    it('should stop process all', function(done) {
      pm2.stop('all', function(err, ret) {
        should(err).be.null;
        pm2.describe(procs[0].pm2_env.pm_id, function(err, procs) {
          should(err).be.null;
          procs[0].pm2_env.status.should.eql('stopped');
          done();
        });
      });
    });
  });



  describe('start OR restart', function() {
    before(function(done) {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should start', function(done) {
      pm2._jsonStartOrAction('restart', process.cwd() + '/test/fixtures/all2.json', {}, function(err, data) {
        should(err).be.null;
        pm2.list(function(err, ret) {
          should(err).be.null;
          ret.length.should.eql(4);
          done();
        });
      });
    });

    it('should NOW restart action', function(done) {
      pm2._jsonStartOrAction('restart', process.cwd() + '/test/fixtures/all2.json', {}, function(err, data) {
        should(err).be.null;
        pm2.list(function(err, ret) {
          should(err).be.null;
          should(ret[0].pm2_env['NODE_ENV']).not.exist;
          ret.forEach(function(app) {
            app.pm2_env.restart_time.should.eql(1);
          });
          setTimeout(function() { done(); }, 500);
        });
      });
    });

    it('should reset status', function(done) {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });

    it('should start with specific environment variables depending on the env type', function(done) {
      pm2._jsonStartOrAction('restart', process.cwd() + '/test/fixtures/all2.json', {
        env : 'production'
      }, function(err, data) {
        should(err).be.null;
        pm2.list(function(err, ret) {
          should(err).be.null;
          ret[0].pm2_env['NODE_ENV'].should.eql('production');
          ret[0].pm2_env['TOTO'].should.eql('heymoto');
          done();
        });
      });
    });

  });

});
