
process.env.NODE_ENV = 'local_test';
process.env.KM_URL_REFRESH_RATE = 1000;

var axon       = require('pm2-axon');
var PM2        = require('../..');
var should = require('should');
var sub;

function listen(cb) {
  sub = axon.socket('sub');
  sub.bind(8080, cb);
}

function listenRev(cb) {
  var listener_server = require('nssocket').createServer(function(_socket) {
  });

  listener_server.listen(4322, '0.0.0.0', function() {
    console.log('Reverse interact online');
    cb();
  });
}

describe('Programmatically test interactor', function() {
  this.timeout(8000);
  var pm2;

  before(function(done) {
    listen(function() {
      listenRev(function() {

        pm2 = new PM2.custom({
          public_key : 'xxx',
          secret_key : 'yyy',
          cwd        : __dirname + '/../fixtures/interface'
        });

        pm2.connect(function() {
          pm2.kill(function() {
            done();
          });
        });
      });
    });
  });

  after(function(done) {
    pm2.kill(done);
  });

  describe('application testing', function() {
    it('should start test application', function(done) {
      sub.once('message', function(data) {
        var packet = JSON.parse(data);
        packet.data['process:event'].length.should.eql(2)
        done();
      });

      pm2.start({
        script : 'process_exception_with_logs.js',
        name   : 'API'
      }, function(err, data) {
        //console.log(arguments);
      });
    });

    it('should get transaction trace via interactor output', function(done) {
      (function callAgain() {
        sub.once('message', function(data) {
          var packet = JSON.parse(data);

          if (packet.data['process:exception']) {
            //console.dir(packet.data['process:exception'][0].data.last_logs);
            //packet.data['process:exception'][0].data.last_logs.length.should.eql(3);
            packet.data['process:exception'][0].data.last_logs[0].should.containEql('Im going to crash');
            //console.log
            done();
          }
          else callAgain();
        });
      })()

      pm2.trigger('API', 'exception');
    });

  });
});
