
/**
 * Test Satan in a programmatic way
 */

var Satan  = require('../lib/Satan.js');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('Satan', function() {

  after(function(done) {
    Satan.disconnectRPC(done);
  });

  it('should start Satan interaction', function(done) {
    Satan.start(function(err) {
      should(err).be.null;
      done();
    });
  });

});
