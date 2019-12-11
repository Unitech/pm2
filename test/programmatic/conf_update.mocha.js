
const PM2 = require('../..');
const should = require('should');

process.chdir(__dirname);

describe('Modules programmatic testing', function() {
  var pm2;

  after(function(done) {
    pm2.kill(done);
  });

  it('should instanciate PM2', function() {
    pm2 = new PM2.custom({
      cwd : '../fixtures'
    });
  });

  it('should start 4 processes', function(done) {
    pm2.start({
      script    : './echo.js',
      instances : 4,
      uid : process.env.USER,
      force : true
    }, function(err, procs) {
      should(err).eql(null);
      should(procs.length).eql(4);
      should(procs[0].pm2_env.uid).eql(process.env.USER);
      done();
    });
  });

  it('should start 4 processes', function(done) {
    pm2.restart('echo', {
      uid : process.env.USER
    }, function(err, procs) {
      console.log(JSON.stringify(procs[0].pm2_env, '', 2));
      should(err).eql(null);
      should(procs.length).eql(4);
      should(procs[0].pm2_env.uid).eql(process.env.USER);
      done();
    });
  });
});
