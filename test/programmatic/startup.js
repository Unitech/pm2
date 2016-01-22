var should = require('should')
var assert = require('better-assert');
var p = require('path');
var fs = require('fs')
var extend = require('util')._extend
var cst = require('../../constants.js')

var cwd = p.resolve(__dirname, '../fixtures/watcher')
process.chdir(cwd)

var unixHelper = require('../../lib/CLI/Startup/UnixHelper.js')
var Startup = require('../../lib/CLI/Startup.js')

var SUPPORTED_PLATFORMS = ['freebsd', 'systemd', 'centos', 'amazon', 'gentoo', 'darwin'];

describe('CLI.Startup', function() {

  it('should warn unprivileged', function(cb) {
    Startup._warnUnprivileged('ubuntu', 'user', '/home/user', function(err) {
     err.should.be.an.instanceof(Error);
     err.message.should.eql('You have to run this with elevated rights');
     cb();
    })
  })

  it('should get correct home directory from username', function(cb) {
    this.skip()
    var username = null
    require('child_process')
    .exec('getent passwd "'+process.getuid()+'" | cut -d: -f1', function(err, user) {
      should(err).be.null
       
      Startup._detectHomeDir(user.trim(), function(err, home) {
        should(err).be.null
        home.should.eql(process.env.HOME)
        cb()
      })
    })
  })

  describe('unix', function() {
            
    it('should get script context', function() {
      var u = unixHelper('ubuntu', 'root', '/root');
      var context = u.getScriptContext();

      context.should.have.keys(['pm2Path', 'home', 'user', 'nodePath']);
    })

    it('should get source path', function() {
      for(var i in SUPPORTED_PLATFORMS) {
       var platform = SUPPORTED_PLATFORMS[i];
       var u = unixHelper(platform, 'root', '/root');

       u.getSourcePath().should.eql(cst[platform.toUpperCase() + '_STARTUP_SCRIPT']);
      }
    })

    it('should get dest path', function() {
      for(var i in SUPPORTED_PLATFORMS) {
        var platform = SUPPORTED_PLATFORMS[i];
        var u = unixHelper(platform, 'root', '/root');
        var dest = u.getDestPath();

        switch (platform) {
          case 'darwin':
            dest.should.eql('/Library/LaunchAgents/io.keymetrics.PM2.plist');
            break;
          case 'freebsd':
            dest.should.eql('/etc/rc.d/pm2');
            break;
          case 'systemd':
            dest.should.eql('/etc/systemd/system/pm2.service');
            break;
          default:
            dest.should.eql('/etc/init.d/pm2-init.sh');
        }
      }
    })

    it('should get darwin dest path without root', function() {
        var u = unixHelper('darwin', 'me', '/Users/me')
        var dest = u.getDestPath();
        dest.should.eql('/Users/me/Library/LaunchAgents/io.keymetrics.PM2.plist');
    })

    it('should get schedule command', function() {
      for(var i in SUPPORTED_PLATFORMS) {
        var platform = SUPPORTED_PLATFORMS[i];
        var u = unixHelper(platform, 'someuser', '/somehome');
        var cmd = u.getScheduleCommand('/some/path');

        switch (platform) {
          case 'freebsd':
            cmd.should.eql('su root -c "chmod +x /some/path"');
            break;
          case 'systemd':
            cmd.should.eql('su someuser -c "pm2 dump && pm2 kill" && su root -c "systemctl daemon-reload && systemctl enable pm2 && systemctl start pm2"');
            break;
          case 'centos':
            cmd.should.eql('su -c "chmod +x /some/path; chkconfig --add path"');
            break;
          case 'amazon':
            cmd.should.eql('su -c "chmod +x /some/path; chkconfig --add path"');
            break;
          case 'gentoo':
            cmd.should.eql('su -c "chmod +x /some/path; rc-update add path default"');
            break;
          default:
            cmd.should.eql('pm2 dump');
        }
      }
    })
  })
})

