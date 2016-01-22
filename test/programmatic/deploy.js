var should = require('should')
var assert = require('better-assert');
var p = require('path');
var fs = require('fs')
var EventEmitter = require('events').EventEmitter
var pm2  = require('../..');

describe('Deploy', function() {
  it('should fail because of unspecified environment', function(cb) {
    path = process.cwd() + '/test/fixtures/deploy.json'

    pm2.deploy(path, {rawArgs: ["deploy", path]}, function(err, data) {
      err.should.eql("Configuration file has more than 1 environment. Needs to specify which one.")
      cb();
    });
  });
});
