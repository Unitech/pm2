
var Monit = require('../lib/monit.js');
var should = require('should');
var assert = require('better-assert');

describe('Monit', function() {
  it('should have right properties', function() {
    Monit.should.have.property('init');
    Monit.should.have.property('refresh');
  });
});
