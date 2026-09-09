
var axon = require('..')
  , net = require('net')
  , should = require('should');

// a subscriber that stops reading (like `pm2 logs` suspended with Ctrl+Z) is
// dropped once `max pending bytes` is exceeded, a reading one stays connected

var LIMIT = 1024 * 1024;

var pub = axon.socket('pub');
pub.set('max pending bytes', LIMIT);

var payload = Buffer.alloc(64 * 1024, 'x');

pub.bind(4200, function(){
  var reader = net.connect(4200);
  reader.on('data', function(){});

  var stuck = net.connect(4200);
  stuck.on('connect', function(){
    stuck.pause(); // never reads, like a process stopped with SIGSTOP

    var dropped = null;
    pub.on('slow subscriber', function(sock, pending){
      pending.should.be.above(LIMIT);
      sock.remotePort.should.equal(stuck.localPort);
      dropped = sock;
    });

    // peers are registered on the server side asynchronously
    setTimeout(function(){
      pub.socks.length.should.equal(2);

      var sent = 0;
      var timer = setInterval(function(){
        for (var i = 0; i < 8 && !dropped; i++) {
          pub.send(payload);
          sent++;
        }

        if (dropped) {
          clearInterval(timer);
          // the stuck peer is gone, the reading one is kept
          setTimeout(function(){
            pub.socks.length.should.equal(1);
            pub.socks[0].remotePort.should.equal(reader.localPort);
            reader.destroy();
            stuck.destroy();
            pub.close();
          }, 100);
        } else if (sent > 20000) {
          throw new Error('slow subscriber was not dropped after ' + sent + ' messages');
        }
      }, 5);
    }, 50);
  });
});
