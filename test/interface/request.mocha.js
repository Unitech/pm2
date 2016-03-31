
process.env.DEBUG="interface:*";

var should  = require('should');
var assert = require('assert');
var HttpRequest = require('../../lib/Interactor/HttpRequest.js');

var PORT = 8080;

function mockIrritableServer(cb) {
  var http = require('http');
  var url  = require('url');

  function handleRequest(req, res) {
    var uri = url.parse(req.url).pathname;

    if (uri == '/api/node/verifyPM2') {
    //   res.writeHead(505,  {"Content-Type": "text/json"});
    //   return res.end(new Buffer(50).fill('h'));
    // }
    // console.log(uri);
      return false;
    }
    if (uri == '/api/misc/pm2_version') {
      res.writeHead(505);
      return res.end();
    }
  }

  //Create a server
  var server = http.createServer(handleRequest);

  //Lets start our server
  server.listen(PORT, function(err){
    if (err) console.error(err);
    cb(null, server);
  });
}

describe('Http requests', function() {
  var _server = null;

  before(function(done) {
    mockIrritableServer(function(err, server) {
      _server = server;
      done();
    });
  });

  after(function(done) {
    _server.close(done);
  });

  describe('POST', function() {
    it('should post to 404 URL', function(done) {
      HttpRequest.post({
        port : 9999,
        url  : 'http://keymetrics.io/NOTHING',
        data : { no : 'thing' }
      }, function(err, data) {
        assert(err);
        assert(err.code == 'ENOTFOUND');
        assert(data == null);
        done();
      })
    });

    it('should timeout after 7secs', function(done) {
      HttpRequest.post({
        port : PORT,
        url  : '127.0.0.1',
        data : { no : 'thing' }
      }, function(err, data) {
        assert(err);
        assert(err.code == 'ECONNRESET');
        assert(data == null);
        done();
      });
    });

  });

  describe('PING', function() {
    it('should get', function(done) {
      HttpRequest.ping({
        port : PORT,
        url  : '127.0.0.1'
      }, function(err, data) {
        assert(err);
        done();
      });
    });
  });

});
