

var PM2 = require('../..');
var should = require('should');
var shelljs = require('shelljs');
var path = require('path');
var fs = require('fs');

describe('Modules programmatic testing', function() {
  var pm2;

  // after(function(done) {
  //   pm2.kill(done);
  // });

  var MODULE_CONF_PATH;
  var MODULE_PATH;

  it('should instanciate PM2', function() {
    pm2 = new PM2.custom({
      //independent : true,
      //daemon_mode : true
    });

    MODULE_CONF_PATH = pm2._conf.PM2_MODULE_CONF_FILE;
    MODULE_PATH = pm2._conf.DEFAULT_MODULE_PATH;
  });

  it('should cleanup paths', function() {
    fs.writeFileSync(MODULE_CONF_PATH, '{}');
    shelljs.rm('-r', MODULE_PATH);
    shelljs.rm('-r', path.join(pm2._conf.PM2_HOME, 'node_modules'));
  });

  describe('Be able to manage old module system', function() {
    it('should install a module the old school way', function(done) {
      pm2.install('pm2-server-monit', { v1 : true}, function(err, apps) {
        var data = JSON.parse(fs.readFileSync(MODULE_CONF_PATH));
        should.exists(data['module-db']['pm2-server-monit']);
        fs.statSync(path.join(pm2._conf.PM2_HOME, 'node_modules', 'pm2-server-monit'));
        done();
      });
    });

    it('should be able to uninstall module', function(done) {
      pm2.uninstall('pm2-server-monit', function(err, apps) {
        var data = JSON.parse(fs.readFileSync(MODULE_CONF_PATH));
        should.not.exists(data['module-db']['pm2-server-monit']);
        try {
          fs.statSync(path.join(pm2._conf.PM2_HOME, 'node_modules', 'pm2-server-monit'));
        } catch(e) {
          if (!e) done(new Error('module must have been deleted...'));
        }
        done();
      });
    });
  });

  describe('Upgrade module to V2 management', function() {
    it('should install a module the old school way', function(done) {
      pm2.install('pm2-server-monit', { v1 : true}, function(err, apps) {
        var data = JSON.parse(fs.readFileSync(MODULE_CONF_PATH));
        should.exists(data['module-db']['pm2-server-monit']);
        fs.statSync(path.join(pm2._conf.PM2_HOME, 'node_modules', 'pm2-server-monit'));
        done();
      });
    });

    it('should update and still have module started', function(done) {
      pm2.update(function() {
        pm2.list(function(err, procs) {
          should(procs.length).eql(1);
          done();
        });
      });
    });

    it('should reinstall module in new school way', function(done) {
      pm2.install('pm2-server-monit', function(err, apps) {
        var data = JSON.parse(fs.readFileSync(MODULE_CONF_PATH));
        should.exists(data['module-db-v2']['pm2-server-monit']);
        should.not.exists(data['module-db']['pm2-server-monit']);
        try {
          fs.statSync(path.join(pm2._conf.PM2_HOME, 'node_modules', 'pm2-server-monit'));
        } catch(e) {
          if (!e)
            done(new Error('The old module has not been deleted...'));
        }

        fs.statSync(path.join(MODULE_PATH, 'pm2-server-monit', 'node_modules', 'pm2-server-monit'));
        done();
      });
    });

    it('should update and still have module started', function(done) {
      pm2.update(function() {
        pm2.list(function(err, procs) {
          should(procs.length).eql(1);
          done();
        });
      });
    });
  });
});
