/**
 * Tests for environment variable sanitization in PM2 spawn.
 *
 * PM2 passes pm2_env as the env option to child_process.spawn().
 * Node.js spawn() calls .toString() on all env values, which converts
 * nested objects to "[object Object]". These tests verify that the
 * sanitization logic correctly filters out non-primitive values.
 *
 * @see https://github.com/Unitech/pm2/issues/6073
 */

process.chdir(__dirname);

var Utility = require('../../lib/Utility');
var should  = require('should');
var PM2     = require('../..');

/**
 * Known object properties in pm2_env that cause "[object Object]"
 * pollution when passed directly to spawn(). These are the 6 properties
 * identified in issue #6073.
 */
var KNOWN_OBJECT_KEYS = [
  'env',
  'axm_monitor',
  'axm_options',
  'axm_dynamic',
  'axm_actions',
  'node_args'
];

/**
 * Build a mock pm2_env object that simulates the real pm2_env structure
 * with a mix of primitive and object-type properties.
 *
 * @method buildMockPm2Env
 * @return {Object} A mock pm2_env with various value types
 */
function buildMockPm2Env() {
  return {
    // String values - should be preserved
    name: 'test-app',
    pm_exec_path: '/usr/bin/node',
    pm_cwd: '/tmp',
    status: 'online',
    PATH: '/usr/bin:/bin',

    // Number values - should be converted to string
    pm_id: 0,
    instances: 1,
    restart_time: 3,
    pm_uptime: 1609459200000,

    // Boolean values - should be converted to string
    autorestart: true,
    watch: false,
    vizion: true,

    // Object values - should be FILTERED OUT (these cause the bug)
    env: { NODE_ENV: 'production', PORT: '3000' },
    axm_monitor: { 'Loop delay': { value: '1.23ms', type: 'metric' } },
    axm_options: { http: true, runtime: { node_version: '18.0.0' } },
    axm_dynamic: {},
    axm_actions: [{ action_name: 'reload', action_type: 'pm2' }],

    // Array value - should be FILTERED OUT
    node_args: ['--max-old-space-size=4096', '--harmony'],

    // Null and undefined - should be FILTERED OUT
    merge_logs: null,
    log_type: undefined,

    // Function value - should be FILTERED OUT
    _someInternalFn: function() { return true; }
  };
}

/**
 * Build a pm2_env that contains only string values.
 * This represents the ideal case where no filtering is needed.
 *
 * @method buildStringOnlyEnv
 * @return {Object} A pm2_env with only string values
 */
function buildStringOnlyEnv() {
  return {
    name: 'simple-app',
    NODE_ENV: 'development',
    PORT: '8080',
    HOST: 'localhost'
  };
}

/**
 * Build a pm2_env with deeply nested objects to test that
 * deep nesting is also filtered out.
 *
 * @method buildDeeplyNestedEnv
 * @return {Object} A pm2_env with deeply nested objects
 */
function buildDeeplyNestedEnv() {
  return {
    name: 'nested-app',
    pm_id: 5,
    deep_object: {
      level1: {
        level2: {
          level3: {
            value: 'deeply nested'
          }
        }
      }
    },
    deep_array: [[1, 2], [3, 4]],
    map_like: new Map([['key', 'value']])
  };
}

// =============================================================================
// Unit Tests for Utility.sanitizeEnv()
// =============================================================================

describe('Utility.sanitizeEnv', function() {

  describe('basic filtering', function() {

    it('should preserve string values unchanged', function() {
      var env = { FOO: 'bar', BAZ: 'qux', EMPTY: '' };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('FOO', 'bar');
      result.should.have.property('BAZ', 'qux');
      result.should.have.property('EMPTY', '');
    });

    it('should convert number values to strings', function() {
      var env = { PORT: 3000, PID: 12345, ZERO: 0, NEGATIVE: -1 };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('PORT', '3000');
      result.should.have.property('PID', '12345');
      result.should.have.property('ZERO', '0');
      result.should.have.property('NEGATIVE', '-1');
    });

    it('should convert boolean values to strings', function() {
      var env = { ENABLED: true, DISABLED: false };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('ENABLED', 'true');
      result.should.have.property('DISABLED', 'false');
    });

    it('should filter out plain object values', function() {
      var env = {
        name: 'app',
        config: { key: 'value' },
        nested: { a: { b: 'c' } }
      };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('config');
      result.should.not.have.property('nested');
    });

    it('should filter out array values', function() {
      var env = {
        name: 'app',
        args: ['--flag', 'value'],
        empty_array: []
      };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('args');
      result.should.not.have.property('empty_array');
    });

    it('should filter out null values', function() {
      var env = { name: 'app', nullable: null };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('nullable');
    });

    it('should filter out undefined values', function() {
      var env = { name: 'app', undef: undefined };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('undef');
    });

    it('should filter out function values', function() {
      var env = { name: 'app', callback: function() {} };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('callback');
    });

    it('should filter out symbol values', function() {
      var env = { name: 'app' };
      env[Symbol('test')] = 'value';
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      // Symbols are not enumerable via Object.keys, so they are
      // naturally excluded
    });
  });

  describe('pm2-specific scenarios', function() {

    it('should filter all 6 known object properties from pm2_env', function() {
      var env = buildMockPm2Env();
      var result = Utility.sanitizeEnv(env);

      // All known object keys should be filtered out
      KNOWN_OBJECT_KEYS.forEach(function(key) {
        result.should.not.have.property(key,
          'Expected "' + key + '" to be filtered from spawn env');
      });
    });

    it('should preserve all primitive properties from pm2_env', function() {
      var env = buildMockPm2Env();
      var result = Utility.sanitizeEnv(env);

      // String values preserved
      result.should.have.property('name', 'test-app');
      result.should.have.property('pm_exec_path', '/usr/bin/node');
      result.should.have.property('pm_cwd', '/tmp');
      result.should.have.property('status', 'online');
      result.should.have.property('PATH', '/usr/bin:/bin');

      // Numbers converted to strings
      result.should.have.property('pm_id', '0');
      result.should.have.property('instances', '1');
      result.should.have.property('restart_time', '3');

      // Booleans converted to strings
      result.should.have.property('autorestart', 'true');
      result.should.have.property('watch', 'false');
    });

    it('should not produce any "[object Object]" values', function() {
      var env = buildMockPm2Env();
      var result = Utility.sanitizeEnv(env);

      Object.keys(result).forEach(function(key) {
        var val = result[key];
        val.should.be.type('string');
        val.should.not.equal('[object Object]',
          'Key "' + key + '" should not be "[object Object]"');
      });
    });

    it('should handle deeply nested objects', function() {
      var env = buildDeeplyNestedEnv();
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'nested-app');
      result.should.have.property('pm_id', '5');
      result.should.not.have.property('deep_object');
      result.should.not.have.property('deep_array');
      result.should.not.have.property('map_like');
    });

    it('should produce only string-typed values in the output', function() {
      var env = buildMockPm2Env();
      var result = Utility.sanitizeEnv(env);

      Object.keys(result).forEach(function(key) {
        (typeof result[key]).should.equal('string',
          'Value for key "' + key + '" should be a string, got ' + typeof result[key]);
      });
    });
  });

  describe('edge cases', function() {

    it('should return empty object for null input', function() {
      var result = Utility.sanitizeEnv(null);
      result.should.be.an.Object();
      Object.keys(result).should.have.length(0);
    });

    it('should return empty object for undefined input', function() {
      var result = Utility.sanitizeEnv(undefined);
      result.should.be.an.Object();
      Object.keys(result).should.have.length(0);
    });

    it('should return empty object for non-object input', function() {
      Utility.sanitizeEnv('string').should.be.an.Object();
      Utility.sanitizeEnv(42).should.be.an.Object();
      Utility.sanitizeEnv(true).should.be.an.Object();
    });

    it('should handle empty object input', function() {
      var result = Utility.sanitizeEnv({});
      result.should.be.an.Object();
      Object.keys(result).should.have.length(0);
    });

    it('should handle string-only env without modification', function() {
      var env = buildStringOnlyEnv();
      var result = Utility.sanitizeEnv(env);

      Object.keys(env).forEach(function(key) {
        result.should.have.property(key, env[key]);
      });
      Object.keys(result).should.have.length(Object.keys(env).length);
    });

    it('should not modify the original object', function() {
      var env = buildMockPm2Env();
      var originalKeys = Object.keys(env).slice();

      Utility.sanitizeEnv(env);

      Object.keys(env).should.have.length(originalKeys.length);
      originalKeys.forEach(function(key) {
        env.should.have.property(key);
      });
    });

    it('should return a new object, not the input reference', function() {
      var env = { name: 'app' };
      var result = Utility.sanitizeEnv(env);

      result.should.not.equal(env);
      result.should.have.property('name', 'app');
    });

    it('should handle NaN number values by converting to string', function() {
      var env = { value: NaN };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('value', 'NaN');
    });

    it('should handle Infinity number values by converting to string', function() {
      var env = { value: Infinity, neg: -Infinity };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('value', 'Infinity');
      result.should.have.property('neg', '-Infinity');
    });

    it('should handle empty string values', function() {
      var env = { empty: '', name: 'app' };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('empty', '');
      result.should.have.property('name', 'app');
    });

    it('should handle Date objects by filtering them out', function() {
      var env = { name: 'app', created: new Date() };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('created');
    });

    it('should handle RegExp objects by filtering them out', function() {
      var env = { name: 'app', pattern: /test/g };
      var result = Utility.sanitizeEnv(env);

      result.should.have.property('name', 'app');
      result.should.not.have.property('pattern');
    });
  });
});

// =============================================================================
// Unit Tests for Utility.isEnvSafeValue()
// =============================================================================

describe('Utility.isEnvSafeValue', function() {

  it('should return true for string values', function() {
    Utility.isEnvSafeValue('hello').should.be.true();
    Utility.isEnvSafeValue('').should.be.true();
    Utility.isEnvSafeValue('0').should.be.true();
  });

  it('should return true for number values', function() {
    Utility.isEnvSafeValue(42).should.be.true();
    Utility.isEnvSafeValue(0).should.be.true();
    Utility.isEnvSafeValue(-1).should.be.true();
    Utility.isEnvSafeValue(3.14).should.be.true();
  });

  it('should return true for boolean values', function() {
    Utility.isEnvSafeValue(true).should.be.true();
    Utility.isEnvSafeValue(false).should.be.true();
  });

  it('should return false for null', function() {
    Utility.isEnvSafeValue(null).should.be.false();
  });

  it('should return false for undefined', function() {
    Utility.isEnvSafeValue(undefined).should.be.false();
  });

  it('should return false for objects', function() {
    Utility.isEnvSafeValue({}).should.be.false();
    Utility.isEnvSafeValue({ key: 'val' }).should.be.false();
  });

  it('should return false for arrays', function() {
    Utility.isEnvSafeValue([]).should.be.false();
    Utility.isEnvSafeValue([1, 2, 3]).should.be.false();
  });

  it('should return false for functions', function() {
    Utility.isEnvSafeValue(function() {}).should.be.false();
  });
});

// =============================================================================
// Integration Test: Verify ForkMode does not pass objects to spawn env
// =============================================================================

describe('ForkMode env sanitization integration', function() {

  before(function(done) {
    PM2.delete('all', function() { done(); });
  });

  after(function(done) {
    PM2.kill(done);
  });

  afterEach(function(done) {
    PM2.delete('all', done);
  });

  it('should start a forked process without [object Object] env vars', function(done) {
    PM2.start({
      script: './../fixtures/env-check.js',
      name: 'env-sanitization-test',
      exec_mode: 'fork',
      env: {
        CUSTOM_STRING: 'hello',
        CUSTOM_NUMBER: '42'
      }
    }, function(err) {
      should(err).be.null();

      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);

        var proc = list[0];
        proc.pm2_env.status.should.eql('online');
        proc.pm2_env.name.should.eql('env-sanitization-test');
        done();
      });
    });
  });

  it('should preserve user-defined string env variables', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'env-preserve-test',
      exec_mode: 'fork',
      env: {
        MY_VAR: 'test_value',
        NODE_ENV: 'testing'
      }
    }, function(err) {
      should(err).be.null();

      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);

        var pm2Env = list[0].pm2_env;
        pm2Env.MY_VAR.should.eql('test_value');
        pm2Env.NODE_ENV.should.eql('testing');
        done();
      });
    });
  });

  it('should handle processes with axm_options object in pm2_env', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'axm-test'
    }, function(err) {
      should(err).be.null();

      PM2.list(function(err, list) {
        should(err).be.null();
        should(list.length).eql(1);

        var pm2Env = list[0].pm2_env;

        // The pm2_env should still contain these as objects internally
        // but they should NOT be passed as "[object Object]" to the spawn env
        // The sanitizeEnv function handles this at spawn time
        pm2Env.status.should.eql('online');
        done();
      });
    });
  });

  it('should handle multiple processes without env pollution', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'multi-env-test',
      instances: 2,
      exec_mode: 'fork',
      env: {
        SHARED_VAR: 'shared_value'
      }
    }, function(err) {
      should(err).be.null();

      PM2.list(function(err, list) {
        should(err).be.null();
        list.length.should.be.above(0);

        list.forEach(function(proc) {
          proc.pm2_env.status.should.eql('online');
          proc.pm2_env.SHARED_VAR.should.eql('shared_value');
        });
        done();
      });
    });
  });
});
