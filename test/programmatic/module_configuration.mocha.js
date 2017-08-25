
process.env.NODE_ENV = 'test';

var PM2    = require('../..');
var should = require('should');
var path   = require('path');
var Plan   = require('../helpers/plan.js');
var fs = require('fs');

process.chdir(__dirname);

describe('Module default flush configuration', function() {
  this.timeout(30000);

  before(function(done) {
    PM2.unset('pm2-logrotate', done);
  });

  it('should install a module', function(done) {
    PM2.install('pm2-logrotate', function() {
      setTimeout(done, 1000);
    });
  });

  it('should module configuration have module options', function(done) {
    var conf = require(process.env.HOME + '/.pm2/module_conf.json');
    should(conf['pm2-logrotate'].max_size).eql('10M');
    should(conf['pm2-logrotate'].retain).eql('all');
    should(conf['pm2-logrotate'].rotateModule).eql(true);
    done();
  });

  it('should change configuration', function(done) {
    PM2.set('pm2-logrotate.max_size', '20M', done);
  });

  it('should have right value', function() {
    var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'));
    should(conf['pm2-logrotate'].max_size).eql('20M');
  });

  it('should re install a module and not override previous set value', function() {
    var conf = JSON.parse(fs.readFileSync(process.env.HOME + '/.pm2/module_conf.json'));
    should(conf['pm2-logrotate'].max_size).eql('20M');
  });

  it('should uninstall module', function(done) {
    PM2.uninstall('pm2-logrotate', done);
  });


});
