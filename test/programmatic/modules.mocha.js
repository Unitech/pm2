
const PM2 = require('../..');
const should = require('should');

describe('Modules programmatic testing', function() {
  var pm2;

  after(function(done) {
    pm2.kill(done);
  });

  it('should instanciate PM2', function() {
    pm2 = new PM2.custom({
      daemon_mode : true
    });
  });

  it('should install a module', function(done) {
    pm2.install('pm2-server-monit', function(err, apps) {
      should(err).eql(null);
      should(apps.length).eql(1);
      var pm2_env = apps[0].pm2_env;
      should.exist(pm2_env);
      done();
    });
  });

  it.skip('should run post install command', function(done) {
    var fs = require('fs');
    var ec = {};
    ec.dependencies = new Array();
    ec.dependencies.push('pm2-server-monit');
    ec.post_install = {};
    ec.post_install['pm2-server-monit'] = 'echo "test passed!"';
    fs.appendFileSync('test.json', JSON.stringify(ec));
    pm2.install('test.json', function() {
      fs.unlinkSync('test.json');
      done();
    });
  });

  it('should list one module', function(done) {
    pm2.list(function(err, apps) {
      should(err).eql(null);
      should(apps.length).eql(1);
      var pm2_env = apps[0].pm2_env;
      should(pm2_env.status).eql('online');
      done();
    });
  });

  it('should uninstall all modules', function(done) {
    pm2.uninstall('all', function(err, apps) {
      done();
    });
  });
});
