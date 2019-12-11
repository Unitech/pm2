
var should = require('should');
var PM2 = require('../..');

var Configuration = require('../../lib/Configuration.js');

describe('Configuration via SET / GET tests', function() {
  before(function(done) {
    PM2.list(done);
  });

  it('should set a value', function(done) {
    Configuration.set('key1', 'val1', function(err, data) {
      should.not.exists(err);
      done();
    });
  });

  it('should get all values', function(done) {
    Configuration.getAll(function(err, data) {
      should.not.exists(err);
      data.key1.should.eql('val1');
      done();
    });
  });

  it('should set another value', function(done) {
    Configuration.set('key2', 'val2', function(err, data) {
      should.not.exists(err);
      done();
    });
  });

  it('should get all values', function(done) {
    Configuration.getAll(function(err, data) {
      should.not.exists(err);
      data.key1.should.eql('val1');
      data.key2.should.eql('val2');
      done();
    });
  });

  it('should unset first value', function(done) {
    Configuration.unset('key1', function(err, data) {
      should.not.exists(err);
      done();
    });
  });

  it('should get all values', function(done) {
    Configuration.getAll(function(err, data) {
      should.not.exists(err);
      should.not.exists(data.key1);
      data.key2.should.eql('val2');
      done();
    });
  });

  it('should get all values SYNCHRONOUSLY', function() {
    var data = Configuration.getAllSync();

    should.not.exists(data.key1);
    data.key2.should.eql('val2');
  });

  describe('Sub value system', function() {
    it('should set a sub key', function(done) {
      Configuration.set('module-name.var1', 'val1', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should set a second sub key', function(done) {
      Configuration.set('module-name.var2', 'val2', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should get the val', function(done) {
      Configuration.getAll(function(err, data) {
        should.not.exists(err);
        data['module-name']['var1'].should.eql('val1');
        data['module-name']['var2'].should.eql('val2');
        done();
      });
    });

    it('should get the val with .get', function(done) {
      Configuration.get('module-name.var1', function(err, data) {
        should.not.exists(err);
        data.should.eql('val1');
        done();
      });
    });

    it('should get the val with .get', function(done) {
      Configuration.get('module-name.var2', function(err, data) {
        should.not.exists(err);
        data.should.eql('val2');
        done();
      });
    });

    it('should NOT get the val with .get', function(done) {
      Configuration.get('moduleasd-name.var2', function(err, data) {
        should.exists(err);
        should(data).be.null();
        done();
      });
    });

    it('should NOT get the val with .get', function(done) {
      Configuration.get('module-name.var3', function(err, data) {
        should.exists(err);
        should(data).be.null();
        done();
      });
    });

  });

  describe('Sub value system with :', function() {
    it('should set a sub key', function(done) {
      Configuration.set('module-name2:var1', 'val1', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should set a second sub key', function(done) {
      Configuration.set('module-name2:var2', 'val2', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should get the val', function(done) {
      Configuration.getAll(function(err, data) {
        should.not.exists(err);
        data['module-name2']['var1'].should.eql('val1');
        data['module-name2']['var2'].should.eql('val2');
        done();
      });
    });

    it('should unset the val', function(done) {
      Configuration.unset('module-name2:var2', function(err, data) {
        should.not.exists(err);
        data['module-name2']['var1'].should.eql('val1');
        should.not.exists(data['module-name2']['var2']);
        done();
      });
    });

  });

  describe('Sync', function() {
    before(function() {
      Configuration.unsetSync('module-name2');
    });

    it('should have 0 modules listed', function(done) {
      var data = Configuration.getSync('module-name2');

      should(data).be.null();
      done();
    });

    it('should set a sub key', function(done) {
      var ret = Configuration.setSync('module-name2:var1', 'val1');

      done();
    });

    it('should have one key', function(done) {
      var data = Configuration.getSync('module-name2');

      data['var1'].should.eql('val1');
      done();
    });


    it('should set a second sub key', function(done) {
      var ret = Configuration.setSync('module-name2:var2', 'val2');

      done();
    });

    it('should get the val', function() {
      var data = Configuration.getSync('module-name2:var2');
      data.should.eql('val2');
    });

    it('should get null for unknown val', function() {
      var data = Configuration.getSync('module-name2:var23333');
      should(data).be.null();
    });

  });

  describe('Not split what is inside double quotes', function() {
    it('should do it', function(done) {
      Configuration.set('module-name2:"var2:toto"', 'val2', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should get the val', function() {
      var data = Configuration.getSync('module-name2:"var2:toto"');
      data.should.eql('val2');
    });

    it('should do it', function(done) {
      Configuration.set('module-name3."var45.toto"', 'val2', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should get the val', function() {
      var data = Configuration.getSync('module-name3."var45.toto"');
      data.should.eql('val2');
    });

  });

  describe('Multiset', function() {
    it('should mutliset configuration', function(done) {
      Configuration.multiset('module-name3."var45.toto" val2 k2 v2 k3 v3', function(err, data) {
        should.not.exists(err);
        done();
      });
    });

    it('should get values', function(done) {
      var data = Configuration.getSync('module-name3."var45.toto"');
      data.should.eql('val2');
      data = Configuration.getSync('k2');
      data.should.eql('v2');
      data = Configuration.getSync('k3');
      data.should.eql('v3');
      done();
    });

  });

});
