var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var fs     = require('fs');

describe('systemd-user startup testing', function() {
  var pm2 = new PM2.custom();
  var user = process.env.USER || process.env.LOGNAME;
  var targetFile = path.join(process.env.HOME, '.config/systemd/user/pm2-' + user + '.service');

  after(function(done) {
    pm2.uninstallStartup('systemd-user', {}, function(err) {
      done();
    });
  });

  it('should generate systemd-user startup script without root', function(done) {
    pm2.startup('systemd-user', {}, function(err, result) {
      should(err).be.null();
      should(fs.existsSync(targetFile)).be.true();
      var content = fs.readFileSync(targetFile, 'utf8');
      should(content).match(/WantedBy=default\.target/);
      should(content).not.match(/User=/);
      done();
    });
  });

  it('should uninstall systemd-user startup script', function(done) {
    pm2.uninstallStartup('systemd-user', {}, function(err, result) {
      should(err).be.null();
      should(fs.existsSync(targetFile)).be.false();
      done();
    });
  });
});
