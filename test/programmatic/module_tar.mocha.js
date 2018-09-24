
const PM2 = require('../..');
const should = require('should');
const exec = require('child_process').exec
const path = require('path')
const fs = require('fs')

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

  describe('Install', function() {
    it('should create a tarball from module folder', function(done) {
      exec(`tar zcf http.tar.gz -C ${path.join(__dirname, '../fixtures')} module`, function(err,sto, ster) {
        done()
      })
    });

    it('should install module', function(done) {
      pm2.install('http.tar.gz', {
        tarball: true
      }, function(err, apps) {
        should(err).eql(null);
        done();
      });
    });

    it('should have file decompressed in the right folder', function() {
      // http-module name comes from decompressing only the package.json and retrieving the name attr
      var target_path = path.join(PM2._conf.DEFAULT_MODULE_PATH, 'http-module')
      fs.readFileSync(path.join(target_path, 'package.json'))
      fs.readFileSync(path.join(target_path, 'ecosystem.config.js'))
    })

    it('should have boot key present', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.exist(conf['tar-modules']['http-module']);
      done()
    })

    it('should have started 2 apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2)
        should(list[0].pm2_env.status).eql('online')
        should(list[1].pm2_env.status).eql('online')
        done()
      })
    })
  })

  describe('Reinstall', () => {
    it('should install module', function(done) {
      pm2.install('http.tar.gz', {
        tarball: true
      }, function(err, apps) {
        should(err).eql(null);
        done();
      });
    });

    it('should have only 2 apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2)
        should(list[0].pm2_env.status).eql('online')
        should(list[1].pm2_env.status).eql('online')
        done()
      })
    })
  })

  describe('Re spawn PM2', () => {
    it('should kill/resurect pm2', (done) => {
      pm2.update(function(err) {
        should(err).be.null();
        done()
      })
    })

    it('should have boot key present', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.exist(conf['tar-modules']['http-module']);
      done()
    })

    it('should have started 2 apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2)
        should(list[0].pm2_env.status).eql('online')
        should(list[1].pm2_env.status).eql('online')
        done()
      })
    })
  })

  describe('CLI UX', () => {
    it('should not delete modules when calling pm2 delete all', (done) => {
      pm2.delete('all', (err, apps) => {
        should(apps.length).eql(2)
        done()
      })
    })
  })

  describe('Uninstall', () => {
    it('should uninstall multi app module', (done) => {
      pm2.uninstall('http-module', (err, data) => {
        should(err).be.null();
        done()
      })
    })

    it('should have boot key deleted', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.not.exist(conf['tar-modules']['http-module']);
      done()
    })

    it('should have no running apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(0)
        done()
      })
    })
  })
})
