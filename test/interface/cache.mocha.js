
var should = require('should');
var Utility = require('../../lib/Interactor/Utility.js');
var path = require('path');
var fs = require('fs');

describe('Cache Utility', function() {
  var aggregator;
  var stackParser;
  var cache;

  it('should instanciate context cache', function() {
    cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key));
          return content.toString().split(/\r?\n/);
        } catch (err) {
          return null;
        }
      }
    })
  });

  it('should get null without key', function() {
    should(cache.get()).be.null();
  });

  it('should get null with unknow value', function() {
    should(cache.get('toto')).be.null();
  });

  it('should get null', function() {
    should(cache.get()).be.null();
  });

  it('should set null', function() {
    should(cache.set()).be.false();
  });

  it('should not set key without value', function() {
    should(cache.set('toto')).be.false();
  });

  it('should set value', function() {
    should(cache.set('toto', 'val')).be.true();
  });

  it('should get value', function() {
    should(cache.get('toto')).eql('val');
  });

  it('should reset', function() {
    cache.reset();
  });

  it('should get null with unknow value', function() {
    should(cache.get('toto')).be.null();
  });

  it('should instanciate context cache with ttl', function() {
    cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key));
          return content.toString().split(/\r?\n/);
        } catch (err) {
          return null;
        }
      },
      ttl: 1
    });
  });

  it('should add a key', function () {
    should(cache.set('toto', 'yeslife')).be.true();
  });

  it('should wait one second to see the key disapear', function (done) {
    setTimeout(function () {
      should(cache.get('toto')).be.null();
      done();
    }, 1000);
  });

});
