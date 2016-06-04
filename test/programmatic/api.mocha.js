
process.env.DEBUG='pm2:api';

var API    = require('../..').api;
var should = require('should');

describe('PM2 API', function() {
  var pma;

  it('should instanciate a new PM2 instance', function(done) {
    pma = new API();
    should.exist(pma.pm2_home);
    done();
  });

  it('should start PM2', function(done) {
    pma.start(function(err, data) {
      console.log(err, data);
      done();
    });
  });

});
