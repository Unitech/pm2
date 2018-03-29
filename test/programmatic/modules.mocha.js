
const PM2 = require('../..');
const should = require('should');

describe('Modules programmatic testing', function() {
  var pm2;

  after(function(done) {
    pm2.destroy(done);
  });

  it('should instanciate PM2', function() {
    pm2 = new PM2.custom({
      independent : true,
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

  it('should list one module', function(done) {
    pm2.list(function(err, apps) {
      should(err).eql(null);
      should(apps.length).eql(1);
      var pm2_env = apps[0].pm2_env;
      should(pm2_env.status).eql('online');
      done();
    });
  });

  it('should install (update) a module with uid option', function(done) {
    pm2.install('pm2-server-monit', {
      uid : process.env.USER
    }, function(err, apps) {
      should(err).eql(null);
      should(apps.length).eql(1);
      var pm2_env = apps[0].pm2_env;
      should.exist(pm2_env);
      should(pm2_env.uid).eql(process.env.USER);
      done();
    });
  });

  it('should have uid option via pm2 list', function(done) {
    pm2.list(function(err, apps) {
      should(err).eql(null);
      should(apps.length).eql(1);
      var pm2_env = apps[0].pm2_env;
      should.exist(pm2_env);
      should(pm2_env.uid).eql(process.env.USER);
      done();
    });
  });

  it('should uninstall all modules', function(done) {
    pm2.uninstall('all', function(err, apps) {
      done();
    });
  });
});
