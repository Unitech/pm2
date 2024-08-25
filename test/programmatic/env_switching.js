
/**
 * PM2 programmatic API tests
 */

var PM2    = require('../..');
var should = require('should');
var path   = require('path');

// Change to current folder
process.chdir(__dirname);

var json_declaration_simple = {
  script : './../fixtures/env-switching/child.js',
  name   : 'child',
  // Default environment
  env : {
    NODE_ENV : 'normal'
  },
  // Prod
  env_production : {
    NODE_ENV : 'production'
  },
  // Test
  env_test : {
    NODE_ENV : 'test'
  }
};

var json_declaration = {
  script : './../fixtures/env-switching/child.js',
  instances: '8',
  // Default environment
  env : {
    NODE_ENV : 'normal'
  },
  // Prod
  env_production : {
    NODE_ENV : 'production'
  },
  // Test
  env_test : {
    NODE_ENV : 'test'
  }
};

describe('PM2 programmatic calls', function() {

  var proc1 = null;
  var procs = [];
  var bus   = null;

  var pm2 = new PM2.custom({ });

  after(function(done) {
    pm2.kill(done);
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

  it('should start a script in production env and NODE_ENV have right value', function(done) {
    pm2.start(json_declaration, {
      env : 'production'
    }, function(err, data) {
      proc1 = data[0];
      should(err).be.null();
      proc1.pm2_env['NODE_ENV'].should.eql('production');
      done();
    });
  });

  it('should start a script in production env and NODE_ENV have right value', function(done) {
    pm2.restart(json_declaration, {
      env : 'production'
    }, function(err, data) {
      proc1 = data[0];
      should(err).be.null();
      proc1.pm2_env.env['NODE_ENV'].should.eql('production');
      done();
    });
  });

  it('should restarted process stay stable', function(done) {
    setTimeout(function() {
      pm2.list(function(err, ret) {
        should(ret[0].pm2_env.restart_time).eql(1)
        done();
      });
    }, 1000)
  });

  it('should delete all processes', function(done) {
    pm2.delete('all', function(err, ret) {
      done();
    });
  });

  it('should start a script and NODE_ENV have right value', function(done) {
    pm2.start(json_declaration, function(err, data) {
      proc1 = data[0];
      should(err).be.null();
      proc1.pm2_env['NODE_ENV'].should.eql(json_declaration.env.NODE_ENV);
      done();
    });
  });

  it('should on restart keep previous NODE_ENV value', function(done) {
    pm2.restart(json_declaration, {
      env : 'test'
    }, function(err, data) {
      should(err).be.null();

      data[0].pm2_env.env['NODE_ENV'].should.eql(json_declaration.env_test.NODE_ENV);
      done();
    });
  });

  it('should delete all processes', function(done) {
    pm2.delete('all', function(err, ret) {
      done();
    });
  });

  /**
   * Ensuring that environment update works correct when reloading with JSON config.
   *
   * Related issue:
   * https://github.com/Unitech/pm2/issues/3192
   */
  describe('with updateEnv option', () => {
    const env = {
      shell: {
        initial: {
          SH: 'shell_initial',
          SH_PM: 'shell_initial',
        },
        updated: {
          SH: 'shell_updated',
          SH_PM: 'shell_updated',
        },
      },
      pm2: {
        initial: {
          PM: 'pm2_initial',
          SH_PM: 'pm2_initia',
        },
        updated: {
          PM: 'pm2_updated',
          SH_PM: 'pm2_updated',
        },
      },
    };

    const configInitial = {
      name: 'child-update-env',
      script: './../fixtures/env-switching/child.js',
      instances: '2',
      env: {
        NODE_ENV: 'test',
        ...env.pm2.initial,
      },
    };

    const configUpdated = {
      ...configInitial,
      env: {
        NODE_ENV: 'test',
        ...env.pm2.updated,
      },
    };

    it('should inject shell environment, then inject config environment on start', (done) => {
      Object.assign(process.env, env.shell.initial);

      pm2.start(configInitial, (err, data) => {
        try {
          const pm2Env = data[0] ? data[0].pm2_env || {} : {};
          should(err).be.null();
          should(pm2Env.SH).eql(env.shell.initial.SH);
          should(pm2Env.PM).eql(env.pm2.initial.PM);
          should(pm2Env.SH_PM).eql(env.pm2.initial.SH_PM);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('should inject only config environment on restart when disabled', (done) => {
      Object.assign(process.env, env.shell.updated);

      pm2.restart(configUpdated, { updateEnv: false }, (err) => {
        should(err).be.null();

        pm2.list((err, data) => {
          try {
            const pm2Env = data.find(proc => proc.name === configInitial.name).pm2_env;
            should(err).be.null();
            should(pm2Env.SH).eql(env.shell.initial.SH);
            should(pm2Env.PM).eql(env.pm2.updated.PM);
            should(pm2Env.SH_PM).eql(env.pm2.updated.SH_PM);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    it('should inject shell environment, then inject config environment on start when endabled', (done) => {
      Object.assign(process.env, env.shell.updated);

      pm2.restart(configUpdated, { updateEnv: true }, (err) => {
        should(err).be.null();

        pm2.list((err, data) => {
          try {
            const pm2Env = data.find(proc => proc.name === configInitial.name).pm2_env;
            should(err).be.null();
            should(pm2Env.SH).eql(env.shell.updated.SH);
            should(pm2Env.PM).eql(env.pm2.updated.PM);
            should(pm2Env.SH_PM).eql(env.pm2.updated.SH_PM);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });

    it('should delete all processes', (done) => {
      pm2.delete('all', (err, ret) => {
        done();
      });
    });
  });
});
