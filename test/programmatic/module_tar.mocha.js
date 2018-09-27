
const PM2 = require('../..');
const should = require('should');
const exec = require('child_process').exec
const path = require('path')
const fs = require('fs')

describe('Modules programmatic testing', function() {
  var pm2;

  var MODULE_FOLDER_MONO = path.join(__dirname, './fixtures/tar-module/mono-app-module')
  var MODULE_FOLDER_MULTI = path.join(__dirname, './fixtures/tar-module/multi-app-module')

  var PACKAGE_MONO = path.join(process.cwd(), 'mono-app-module-v0-23-0.tar.gz')
  var PACKAGE_MULTI = path.join(process.cwd(), 'multi-app-module-v0-1.tar.gz')

  after(function(done) {
    pm2.kill(done);
  });

  before(function(done) {
    pm2 = new PM2.custom({
      cwd : './fixtures'
    });

    pm2.uninstall('all', () => done())
  })

  describe('Package', function() {
    before((done) => {
      fs.unlink(PACKAGE_MONO, () => {
        fs.unlink(PACKAGE_MULTI, () => {
          done()
        })
      })
    })

    it('should package tarball for mono app', function(done) {
      pm2.package(MODULE_FOLDER_MONO, (err) => {
        should(err).be.null()
        should(fs.existsSync(PACKAGE_MONO)).eql(true)
        done()
      })
    })

    it('should package tarball for multi app', function(done) {
      pm2.package(MODULE_FOLDER_MULTI, (err) => {
        should(err).be.null()
        should(fs.existsSync(PACKAGE_MULTI)).eql(true)
        done()
      })
    })
  })

  describe('MULTI Install', function() {
    it('should install module', function(done) {
      pm2.install(PACKAGE_MULTI, {
        tarball: true
      }, function(err, apps) {
        should(err).eql(null);
        done();
      });
    });

    it('should have file decompressed in the right folder', function() {
      var target_path = path.join(PM2._conf.DEFAULT_MODULE_PATH, 'multi-app-module')
      fs.readFileSync(path.join(target_path, 'package.json'))
    })

    it('should have boot key present', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.exist(conf['tar-modules']['multi-app-module']);
      done()
    })

    it('should have started 2 apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2)
        should(list[0].pm2_env.version).eql('0.1')
        should(list[0].name).eql('multi-app-module:first_app')
        should(list[1].name).eql('multi-app-module:second_app')
        should(list[1].pm2_env.version).eql('0.1')
        should(list[0].pm2_env.status).eql('online')
        should(list[1].pm2_env.status).eql('online')
        done()
      })
    })
  })

  describe('Reinstall', () => {
    it('should install module', function(done) {
      pm2.install(PACKAGE_MULTI, {
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
      should.exist(conf['tar-modules']['multi-app-module']);
      done()
    })

    it('should have started 2 apps', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(2)
        should(list[0].pm2_env.status).eql('online')
        should(list[0].pm2_env.version).eql('0.1')
        should(list[1].pm2_env.version).eql('0.1')
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
      pm2.uninstall('multi-app-module', (err, data) => {
        should(err).be.null();
        done()
      })
    })

    it('should have boot key deleted', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.not.exist(conf['tar-modules']['multi-app-module']);
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

  describe('MONO APP', () => {
    it('should install module', function(done) {
      pm2.install(PACKAGE_MONO, {
        tarball: true
      }, function(err, apps) {
        should(err).eql(null);
        done();
      });
    });

    it('should have file decompressed in the right folder', function() {
      var target_path = path.join(PM2._conf.DEFAULT_MODULE_PATH, 'mono-app-module')
      var pkg_path = path.join(target_path, 'package.json')
      fs.readFileSync(pkg_path)
    })

    it('should have boot key present', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.exist(conf['tar-modules']['mono-app-module']);
      done()
    })

    it('should have started 1 app', function(done) {
      pm2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1)
        should(list[0].name).eql('mono_app')
        should(list[0].pm2_env.version).eql('0.23.0')
        should(list[0].pm2_env.status).eql('online')
        done()
      })
    })

    it('should uninstall multi app module', (done) => {
      pm2.uninstall('mono-app-module', (err, data) => {
        should(err).be.null();
        done()
      })
    })

    it('should have boot key deleted', function(done) {
      var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'))
      should.not.exist(conf['tar-modules']['mono-app-module']);
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
