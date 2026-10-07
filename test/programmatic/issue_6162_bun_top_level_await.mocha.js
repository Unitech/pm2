/**
 * Regression test for #6162
 *
 * ProcessContainerForkBun.js used require() for every entry script. Bun cannot
 * require() a module graph that contains top-level await, so those apps
 * restart-looped at boot.
 */

process.env.NODE_ENV = 'test';

var PM2 = require('../..');
var should = require('should');
var which = require('../../lib/tools/which.js');

process.chdir(__dirname);

var bunPath = which('bun');
var suite = bunPath ? describe : describe.skip;

suite('Bun fork container top-level await (#6162)', function () {
  this.timeout(15000);

  var pm2 = new PM2.custom({
    cwd: '../fixtures/bun-top-level-await/'
  });

  after(function (done) {
    pm2.kill(done);
  });

  it('should start an ESM app that uses top-level await', function (done) {
    pm2.start({
      script: './app.js',
      name: 'bun-tla',
      exec_mode: 'fork_mode',
      exec_interpreter: bunPath
    }, function (err) {
      should(err).be.null();

      setTimeout(function () {
        pm2.describe('bun-tla', function (err, proc) {
          should(err).be.null();
          proc.length.should.eql(1);
          proc[0].pm2_env.status.should.eql('online');
          proc[0].pm2_env.restart_time.should.be.below(2);
          done();
        });
      }, 2000);
    });
  });
});
