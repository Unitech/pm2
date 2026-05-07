
var fclone = require('../../modules/fclone.js');
var should = require('should');

describe('fclone unit tests', function() {

  describe('will clone', function() {
    it('a string', function() {
      var o = fclone('');
      o.should.equal('');
    });

    it('an object', function() {
      var t = {foo: 'bar', bar: 'foo'};
      var o = fclone(t);
      delete t.foo;
      should(t.foo).be.undefined();
      o.foo.should.equal('bar');
    });

    it('a Date', function() {
      var a = new Date();
      var b = fclone(a);
      b.getTime().should.equal(a.getTime());
      (a !== b).should.be.true();
    });

    it('a Buffer', function() {
      var a = Buffer.from('this is a test');
      var b = fclone(a);
      b.toString().should.equal(a.toString());
      (a !== b).should.be.true();
    });

    it('an Error\'s properties', function() {
      var a = new Error('this is a test');
      var b = fclone(a);
      (a !== b).should.be.true();
      b.should.have.property('name', a.name);
      b.should.have.property('message', a.message);
      b.should.have.property('stack', a.stack);
    });

    it('an inherited property (only own props)', function() {
      function Base() { this.base = true; }
      function Child() { this.child = true; }
      Child.prototype = new Base();
      var z = fclone(new Child());
      z.should.have.property('child', true);
      z.should.not.have.property('base');
    });

    it('an Uint8Array', function() {
      var t = new Uint8Array(3);
      t[0] = 0; t[1] = 1; t[2] = 2;
      var o = fclone(t);
      (o instanceof Uint8Array).should.be.true();
      o.length.should.equal(3);
    });

    it('an array-like object', function() {
      var t = {length: 3, 0: 'test', 1: 'test', 2: 'test', indexOf: Array.prototype.indexOf};
      var o = fclone(t);
      o.should.deepEqual(['test', 'test', 'test']);
    });

    it('an object with subarray method (not typed array)', function() {
      var t = {subarray: function() { return 'fail'; }};
      var o = fclone(t);
      o.should.not.equal('fail');
    });
  });

  describe('will not clone circular data', function() {
    var input, output;

    before(function() {
      input = {};
      input.a = input;
      input.b = {};
      input.b.a = input;
      input.b.b = input.b;
      input.c = {};
      input.c.b = input.b;
      input.c.c = input.c;
      input.x = 1;
      input.b.x = 2;
      input.c.x = 3;
      input.d = [0, input, 1, input.b, 2, input.c, 3];
      output = fclone(input);
    });

    it('base object', function() {
      output.should.have.property('a', '[Circular]');
      output.should.have.property('b');
      output.should.have.property('x', 1);
      output.should.have.property('c');
    });

    it('nested property', function() {
      output.b.should.have.property('a', '[Circular]');
      output.b.should.have.property('b', '[Circular]');
      output.b.should.have.property('x', 2);
    });

    it('secondary nested property', function() {
      output.c.should.not.have.property('a');
      output.c.should.have.property('b');
      output.c.should.have.property('c', '[Circular]');
      output.c.b.should.deepEqual({a: '[Circular]', b: '[Circular]', x: 2});
      output.c.should.have.property('x', 3);
    });

    it('array with circular refs', function() {
      output.d[0].should.equal(0);
      output.d[1].should.equal('[Circular]');
      output.d[2].should.equal(1);
      output.d[3].should.deepEqual({a: '[Circular]', b: '[Circular]', x: 2});
      output.d[4].should.equal(2);
      output.d[5].should.have.property('c', '[Circular]');
      output.d[6].should.equal(3);
    });
  });

  describe('functions preserved (pm2 specific)', function() {
    it('functions are kept as-is', function() {
      var fn = function() { return 42; };
      var t = {name: 'test', send: fn, nested: {handler: fn}};
      var o = fclone(t);
      o.name.should.equal('test');
      o.send.should.equal(fn);
      o.nested.handler.should.equal(fn);
      o.send().should.equal(42);
    });
  });

});
