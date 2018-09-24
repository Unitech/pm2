
const PM2 = require('../..');
const should = require('should');
const exec = require('child_process').exec
const path = require('path')

describe('Modules programmatic testing', function() {
  var pm2;

  // after(function(done) {
  //   pm2.kill(done);
  // });

  it('should instanciate PM2', function() {
    pm2 = new PM2.custom({
      cwd : '../fixtures'
    });
  });

  it('should create a tarball from module folder', function(done) {
    exec(`tar zcf http.tar.gz -C ${path.join(__dirname, '../fixtures')} module`, function(err,sto, ster) {
      done()
    })
  });

  it('install module', function(done) {
    pm2.install('http.tar.gz', {
      tarball: true
    }, function(err, apps) {
      should(err).eql(null);
      done();
    });
  });

})
