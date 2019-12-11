
var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var fs     = require('fs');

describe('Signal kill (+delayed)', function() {
  var proc1 = null;

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures'
  });

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.kill(done);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });
  });

  describe('with 3000ms PM2_KILL_TIMEOUT (environment variable)', function() {
    it('should set 3000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 3000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './signals/delayed_sigint.js',
        name : 'delayed-sigint'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 3000ms', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 2500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 3500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });
  });

  describe('with 1000ms PM2_KILL_TIMEOUT (environment variable)', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './signals/delayed_sigint.js',
        name : 'delayed-sigint'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 1000ms', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 1500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });
  });

  describe('[CLUSTER MODE] with 1000ms PM2_KILL_TIMEOUT (environment variable)', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './signals/delayed_sigint.js',
        name : 'delayed-sigint',
        exec_mode : 'cluster'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 1000ms', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 1500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });

    it('should reload script', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('online');
          done();
        });
      }, 1500);

      pm2.reload('delayed-sigint', function(err, app) {
        //done(err);
      });

    });
  });

  describe('with 4000ms via kill_timeout (json/cli option)', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script with flag kill timeout to 4000ms', function(done) {
      pm2.start({
        script : './signals/delayed_sigint.js',
        name : 'delayed-sigint',
        exec_mode : 'cluster',
        kill_timeout : 4000
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 4000ms (and not 1000ms)', function(done) {
      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 1500);

      setTimeout(function() {
        pm2.list(function(err, list) {
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 4500);

      pm2.stop('delayed-sigint', function(err, app) {
        //done(err);
      });

    });

    it('should delete all', function(done) {
      pm2.delete('all', done)
    })

  });

});

describe('Message kill (signal behavior override via PM2_KILL_USE_MESSAGE, +delayed)', function() {
  var proc1 = null;
  var appName = 'delayedsadsend';

  process.env.PM2_KILL_USE_MESSAGE = true;

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures',
  });

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.kill(done);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        done();
      });
    });
  });

  describe('with 1000ms PM2_KILL_TIMEOUT (environment variable)', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './signals/delayed_send.js',
        error_file : 'error-echo.log',
        out_file   : 'out-echo.log',
        name : appName,
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 1000ms', function(done) {
      setTimeout(function() {
        pm2.describe(appName, function(err, list) {
          should(err).be.null();
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 500);

      setTimeout(function() {
        pm2.describe(appName, function(err, list) {
          should(err).be.null();
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 1500);

      pm2.stop(appName, function(err, app) {
        //done(err);
      });

    });

    it('should read shutdown message', function(done) {
      var out_file = proc1.pm2_env.pm_out_log_path;
      fs.readFileSync(out_file).toString().should.containEql('shutdown message');
      done();
    })

    it('should delete all', function(done) {
      pm2.delete('all', done)
    })

  });

  describe('[CLUSTER MODE] with 1000ms PM2_KILL_TIMEOUT (environment variable)', function() {
    it('should set 1000ms to PM2_KILL_TIMEOUT', function(done) {
      process.env.PM2_KILL_TIMEOUT = 1000;

      pm2.update(function() {
        done();
      });
    });

    it('should start a script', function(done) {
      pm2.start({
        script : './signals/delayed_send.js',
        name : appName,
        exec_mode : 'cluster'
      }, function(err, data) {
        proc1 = data[0];
        should(err).be.null();
        setTimeout(done, 1000);
      });
    });

    it('should stop script after 1000ms', function(done) {
      setTimeout(function() {
        pm2.describe(appName, function(err, list) {
          should(err).be.null();
          list[0].pm2_env.status.should.eql('stopping');
        });
      }, 500);

      setTimeout(function() {
        pm2.describe(appName, function(err, list) {
          should(err).be.null();
          list[0].pm2_env.status.should.eql('stopped');
          done();
        });
      }, 1500);

      pm2.stop(appName, function(err, app) {
        //done(err);
      });

    });

    it('should reload script', function(done) {
      setTimeout(function() {
        pm2.describe(appName, function(err, list) {
          should(err).be.null();
          list[0].pm2_env.status.should.eql('online');
          done();
        });
      }, 1500);

      pm2.reload(appName, function(err, app) {
        //done(err);
      });

    });

    it('should read shutdown message', function(done) {
      var out_file = proc1.pm2_env.pm_out_log_path;
      fs.readFileSync(out_file).toString().should.containEql('shutdown message');
      done();
    })

  });

});
