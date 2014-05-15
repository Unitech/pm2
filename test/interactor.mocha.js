

var Satan;
var should = require('should');
var assert = require('better-assert');
var path = require('path');
var ipm2;
var arr = [];

setTimeout(function() {
  process.exit(0);
}, 15000);

describe('Interactor', function() {

  after(function(done) {
    Satan.killDaemon(function() {
      setTimeout(done, 400);
    });
  });

  it('should auto instancy itself, fire event and kill daemon', function(done) {
    Satan = require('../lib/Satan');
    Satan.start();
    process.once('satan:client:ready', function() {
      console.log('Client ready');
      Satan.killDaemon(function() {
        done();
      });
    });
  });

  it('should start daemon', function(done) {
    Satan.launchDaemon(function(err, child) {
      assert(err == null);
      assert(typeof child.pid == 'number');
      Satan.pingDaemon(function(online) {
        assert(online == true);
        done();
      });
    });
  });

  describe.skip('STRING INTERACTION', function() {
    it('should launch a process', function(done) {
      Satan.executeRemote('prepare', {
        pm_exec_path    : path.resolve(process.cwd(), 'test/fixtures/echo.js'),
        pm_err_log_path : path.resolve(process.cwd(), 'test/errLog.log'),
        pm_out_log_path : path.resolve(process.cwd(), 'test/outLog.log'),
        pm_pid_path     : path.resolve(process.cwd(), 'test/child'),
        instances       : 4
      }, function(err, procs) {
        assert(err == null);
        assert(procs.length == 4);
        done();
      });
    });

    it('should ipm2 connect to God', function(done) {
      ipm2 = require('pm2-interface')();

      ipm2.on('ready', function() {
        console.log('Connected to pm2');

        done();
        ipm2.bus.on('*', function(event, data) {
          arr.push({
            event : event,
            data : data
          });
        });

      });
    });

    it('should output log', function(done) {
      setTimeout(function() {
        arr.some(function(dt) {
          if (dt.event == 'log:out' && dt.data) {
            dt.data.should.be.a.String;
            return true;
          }
          return false;
        });
        done();
      }, 1000);
    });

    it('should output log', function(done) {
      arr.some(function(dt) {
        if (dt.event == 'log:err' && dt.data) {
          dt.data.should.be.a.String;
          return true;
        }
        return false;
      });

      done();
    });
  });

});
