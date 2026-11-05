/**
 * Regression test for #5945
 *
 * `pm2 start 'some command --log-config log.yaml'` was treated as a config
 * file because the command string contains ".yaml", and failed with
 * "File ... not found".
 */

const PM2 = require('../..');
const should = require('should');

process.chdir(__dirname);

describe('Inline command containing a config file extension (#5945)', function () {
  this.timeout(10000);
  var pm2;

  before(function (done) {
    pm2 = new PM2.custom({ cwd: __dirname + '/../fixtures' });
    pm2.delete('all', function () { done(); });
  });

  after(function (done) {
    pm2.kill(done);
  });

  it('should start a shell command that mentions a .yaml file', function (done) {
    pm2.start('echo log_config.yaml && sleep 10', { name: 'inline-yaml' }, function (err, procs) {
      should(err).be.null();
      should(procs.length).eql(1);
      should(procs[0].pm2_env.name).eql('inline-yaml');
      done();
    });
  });

  it('should start a shell command that mentions a .json file', function (done) {
    pm2.start('cat package.json > /dev/null && sleep 10', { name: 'inline-json' }, function (err, procs) {
      should(err).be.null();
      should(procs.length).eql(1);
      should(procs[0].pm2_env.name).eql('inline-json');
      done();
    });
  });

  it('should still start a config file', function (done) {
    pm2.start('echo-pm2.json', function (err, procs) {
      should(err).be.null();
      should(procs.length).be.above(0);
      done();
    });
  });
});
