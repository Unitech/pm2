
var Password = require('../../lib/Interactor/Password.js');
var should   = require('should');

describe('Password test', function() {
  var crypted = '';

  it('should crypt a password', function() {
    crypted = Password.generate('testpass');
  });

  it('should fail with wrong password', function() {
    Password.verify('testpasds', crypted).should.be.false;
  });

  it('should success with right password', function() {
    Password.verify('testpass', crypted).should.be.true;
  });

});
