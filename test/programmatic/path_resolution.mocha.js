
var path = require('path');
process.chdir(path.join(__dirname, '../fixtures'));

var PM2 = require('../..');
var should = require('should');

describe('Path resolution in configuration file', function() {
  before(function(done) {
    PM2.delete('all', function() { done() } );
  });

  afterEach(function(done) {
    PM2.delete('all', function() { done() } );
  });

  it('should resolve paths (home)', function(done) {
    PM2.start('./path-resolution/ecosystem.config.js', function(err, proc) {
      should(proc[0].pm2_env.pm_err_log_path).eql(path.join(process.env.HOME, 'echo-err-0.log'));
      should(proc[0].pm2_env.pm_out_log_path).eql(path.join(process.env.HOME, 'echo-out-0.log'));
      should(proc[0].pm2_env.pm_pid_path).eql(path.join(process.env.HOME, 'echo-pid.log'));
      done();
    });
  });

  it('should resolve paths (local)', function(done) {
    PM2.start('./path-resolution/ecosystem2.config.js', function(err, proc) {
      should(proc[0].pm2_env.pm_err_log_path).eql(path.join(process.cwd(), 'echo-err-0.log'));
      should(proc[0].pm2_env.pm_out_log_path).eql(path.join(process.cwd(), 'echo-out-0.log'));
      should(proc[0].pm2_env.pm_pid_path).eql(path.join(process.cwd(), 'echo-pid.log'));
      done();
    });
  });
});
