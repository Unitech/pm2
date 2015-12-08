

/**
 * PM2 programmatic API tests
 */

var pm2    = require('../..');
var should = require('should');
var assert = require('better-assert');
var path   = require('path');

describe('PM2 programmatic calls', function() {

  var pm2_bus = null;
  var proc1   = null;
  var procs   = [];

  after(function(done) {
    pm2.delete('all', function(err, ret) {
      pm2.disconnectBus();
      pm2.disconnect(done);
    });
  });

  before(function(done) {
    pm2.connect(function() {
      pm2.launchBus(function(err, bus) {
        pm2_bus = bus;

        pm2.delete('all', function(err, ret) {
          done();
        });
      });
    });
  });

  /**
   * process.on('message', function(packet) {
   *   process.send({
   *     type : 'process:msg',
   *     data : {
   *       success : true
   *     }
   *   });
   * });
   */
  it('should start a script', function(done) {
    pm2.start({
      script : './test/fixtures/send-data-process/return-data.js'
    }, function(err, data) {
      proc1 = data[0];
      should(err).be.null;
      done();
    });
  });

  it('should receive data packet', function(done) {
    pm2_bus.on('process:msg', function(packet) {
      packet.data.success.should.eql(true);
      packet.process.pm_id.should.eql(proc1.pm2_env.pm_id);
      done();
    });

    pm2.sendDataToProcessId({
      type : 'process:msg',
      data : {
        some : 'data',
        hello : true
      },
      id   : proc1.pm2_env.pm_id
    }, function(err, res) {
      should(err).be.null;
    });
  });


});
