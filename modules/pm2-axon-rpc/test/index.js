
/**
 * Module dependencies.
 */

var rpc = require('..')
  , axon = require('../../pm2-axon')
  , assert = require('assert');



describe('SOCKET', function() {
  var req, rep, server, client;

  before(function() {
    rep = axon.socket('rep');
    req = axon.socket('req');

    rep.bind(4000);
    req.connect(4000, 'localhost');

    server = new rpc.Server(rep);
    client = new rpc.Client(req);
  });

  after(function() {
    req.close();
    rep.close();
  });

  describe('Server#expose(name, fn)', function(){
    it('should expose a single function', function(done){
      server.expose('add', function(a, b, fn){
        fn(null, a + b);
      });

      client.call('add', 1, 2, function(err, n){
        assert(!err);
        assert(3 === n);
        done();
      });
    });
  });

  describe('Server#expose(obj)', function(){
    it('should expose multiple', function(done){
      server.expose({
        uppercase: function(str, fn){
          fn(null, str.toUpperCase());
        }
      });

      client.call('uppercase', 'hello', function(err, str){
        assert(!err);
        assert('HELLO' == str);
        done();
      });
    });
  });

  describe('Client#methods(fn)', function(){
    it('should respond with available methods', function(done){
      client.methods(function(err, methods){
        assert(!err);
        assert('add' == methods.add.name);
        assert('a' == methods.add.params[0]);
        assert('b' == methods.add.params[1]);
        assert('fn' == methods.add.params[2]);
        assert(methods.uppercase);
        done();
      });
    });
  });

  describe('Client#call(name, ..., fn)', function(){
    describe('when method is not exposed', function(){
      it('should error', function(done){
        client.call('something', function(err){
          assert('method "something" does not exist' == err.message);
          done();
        });
      })
    });

    describe('with an error response', function(){
      it('should provide an Error', function(done){
        var svrErr;
        server.expose('error', function(fn){
          svrErr = new Error('boom');
          fn(svrErr);
        });

        client.call('error', function(err){
          assert(err instanceof Error);
          assert('boom' == err.message);
          assert(err.stack === svrErr.stack, 'Original error stack should have been passed to the client');
          done();
        });
      });

      it('should works with something different than a error', function(done){
        var svrErr;
        server.expose('errorNoStack', function(fn){
          fn('shit');
        });

        client.call('errorNoStack', function(err){
          assert('shit' == err.message);
          done();
        });
      });

      it('empty string edge case should still work', function(done){
        var svrErr;
        server.expose('error', function(fn){
          svrErr = new Error('');
          fn(svrErr);
        });

        client.call('error', function(err){
          assert(err instanceof Error);
          assert(svrErr.message == err.message);
          assert(err.stack === svrErr.stack, 'Original error stack should have been passed to the client');
          done();
        });
      });
    });
  });
});
