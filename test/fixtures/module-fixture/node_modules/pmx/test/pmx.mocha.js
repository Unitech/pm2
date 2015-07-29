
var pmx = require('..');

describe('PMX driver', function() {
  it('should have the right properties', function(done) {
    pmx.should.have.property('emit');
    pmx.should.have.property('action');
    done();
  });

  describe('Event module', function() {
    it('should not hang if process not forked', function(done) {
      pmx.emit('testo', { data : 'ok' });
      done();
    });

  });
});
