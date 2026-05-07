
process.chdir(__dirname);

var path = require('path');
var os = require('os');
var should = require('should');
var pathsFn = require('../../paths.js');

describe('PM2 Home Path Resolution (#6106)', function () {

  var savedEnv;

  beforeEach(function () {
    savedEnv = {};
    ['PM2_HOME', 'HOME', 'HOMEPATH', 'HOMEDRIVE', 'USERPROFILE'].forEach(function (k) {
      savedEnv[k] = process.env[k];
    });
  });

  afterEach(function () {
    Object.keys(savedEnv).forEach(function (k) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    });
  });

  it('should honor PM2_HOME env var override', function () {
    process.env.PM2_HOME = '/custom/pm2/home';
    var paths = pathsFn();
    paths.PM2_HOME.should.eql('/custom/pm2/home');
  });

  it('should resolve from os.homedir() by default', function () {
    delete process.env.PM2_HOME;
    var paths = pathsFn();
    paths.PM2_HOME.should.eql(path.resolve(os.homedir(), '.pm2'));
  });

  it('should resolve correctly when HOME env var is not set (#6106)', function () {
    delete process.env.PM2_HOME;
    delete process.env.HOME;
    delete process.env.HOMEPATH;
    delete process.env.HOMEDRIVE;

    var paths = pathsFn();
    paths.PM2_HOME.should.not.eql(path.resolve('/etc', '.pm2'));
    paths.PM2_HOME.should.eql(path.resolve(os.homedir(), '.pm2'));
  });
});
