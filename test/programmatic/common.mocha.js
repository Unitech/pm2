var path = require('path');
var Common = require('../../lib/Common');
var Config = require('../../lib/tools/Config');
var should = require('should');

process.chdir(__dirname);

describe('Common utilities', function () {
  describe('Config file detection', function () {
    var tests = [
      { arg: "ecosystem.json", expected: "json" },
      { arg: "ecosystem.yml", expected: "yaml" },
      { arg: "ecosystem.yaml", expected: "yaml" },
      { arg: "ecosystem.config.js", expected: "js" },
      { arg: "ecosystem.config.cjs", expected: "js" },
      { arg: "ecosystem.config.mjs", expected: "mjs" },
    ]

    tests.forEach(function (test) {
      it('should accept configuration file ' + test.arg , function () {
        var result = Common.isConfigFile(test.arg);
        should(result).eql(test.expected);
      })
    });

    it('should not accept unknown filename', function () {
      should(Common.isConfigFile('lorem-ipsum.js')).be.null();
    })
  })

  describe('Config file candidates', function () {
    it('should return an array with well-known file extensions', function () {
      var result = Common.getConfigFileCandidates('ecosystem');
      should(result).eql([
        'ecosystem.json',
        'ecosystem.yml',
        'ecosystem.yaml',
        'ecosystem.config.js',
        'ecosystem.config.cjs',
        'ecosystem.config.mjs'
      ]);
    });
  });

  describe('filter_env', function() {
    var script = path.resolve(__dirname, '../fixtures/echo.js');
    var saved = {};

    beforeEach(function() {
      ['LEAK_ME', 'SHOULD_NOT_BE_THERE'].forEach(function(key) {
        saved[key] = process.env[key];
        process.env[key] = '1';
      });
    });

    afterEach(function() {
      Object.keys(saved).forEach(function(key) {
        if (saved[key] === undefined)
          delete process.env[key];
        else
          process.env[key] = saved[key];
      });
    });

    function prepare(filter) {
      return Common.prepareAppConf({ cwd: process.cwd() }, {
        script: script,
        name: 'envtest',
        filter_env: filter,
        env: { ONLY_THIS: '1' }
      });
    }

    it('should drop every shell variable when filter_env is true', function() {
      var app = prepare(true);
      should(app).not.be.instanceof(Error);
      should(app.env.LEAK_ME).be.undefined();
      should(app.env.SHOULD_NOT_BE_THERE).be.undefined();
      should(app.env.PATH).be.undefined();
      should(app.env.ONLY_THIS).eql('1');
    });

    // Config files and schema parsing can hand the boolean over as the string "true".
    it('should drop every shell variable when filter_env is the string true', function() {
      var app = prepare('true');
      should(app).not.be.instanceof(Error);
      should(app.env.LEAK_ME).be.undefined();
      should(app.env.PATH).be.undefined();
      should(app.env.ONLY_THIS).eql('1');
    });

    it('should keep shell variables except names listed in a filter_env array', function() {
      var app = prepare(['SHOULD_NOT_BE_THERE']);
      should(app).not.be.instanceof(Error);
      should(app.env.SHOULD_NOT_BE_THERE).be.undefined();
      should(app.env.LEAK_ME).eql('1');
      should(app.env.PATH).not.be.undefined();
      should(app.env.ONLY_THIS).eql('1');
    });

    it('should drop only the named variable when filter_env is a string', function() {
      var app = prepare('SHOULD_NOT_BE_THERE');
      should(app).not.be.instanceof(Error);
      should(app.env.SHOULD_NOT_BE_THERE).be.undefined();
      should(app.env.LEAK_ME).eql('1');
      should(app.env.ONLY_THIS).eql('1');
    });

    // `pm2 start app.js --filter-env NAME` is collected into an array and
    // mapped onto filter_env by the CLI option alias.
    it('should apply a --filter-env list the same way as a filter_env array', function() {
      var fromCli = Config.filterOptions({ filterEnv: ['SHOULD_NOT_BE_THERE'] });
      should(fromCli.filter_env).eql(['SHOULD_NOT_BE_THERE']);

      var app = prepare(fromCli.filter_env);
      should(app).not.be.instanceof(Error);
      should(app.env.SHOULD_NOT_BE_THERE).be.undefined();
      should(app.env.LEAK_ME).eql('1');
      should(app.env.ONLY_THIS).eql('1');
    });
  });

})
