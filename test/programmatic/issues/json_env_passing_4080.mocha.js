var PM2    = require('../../..');
var should = require('should');

describe('Programmatic log feature test', function() {
  var proc1 = null;
  var procs = [];

  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures/json-env-passing'
  });

  before(function(done) {
    pm2.delete('all', function() {
      done();
    });
  });

  after(function(done) {
    pm2.delete('all', function() {
      pm2.disconnect(done);
    });
  });

  it('should start a process with object as environment variable', function(done) {
    pm2.start({
      script: 'echo.js',
      env: {
        NORMAL: 'STR',
        JSONTEST: { si: 'si' }
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }, function(err, procs) {
      should(err).be.null()
      should(procs.length).eql(1)
      done()
    })
  })

  it('should retrieve environment variable stringified', function(done) {
    pm2.list((err, procs) => {
      should(procs[0].pm2_env.JSONTEST).eql('{"si":"si"}')
      should(procs[0].pm2_env.NORMAL).eql('STR')
      done()
    })
  })
})
