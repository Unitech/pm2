require('./helper');
var Scanner = Mustache.Scanner;

describe('A new Mustache.Scanner', function () {
  describe('for an empty string', function () {
    it('is at the end', function () {
      var scanner = new Scanner('');
      assert(scanner.eos());
    });
  });

  describe('for a non-empty string', function () {
    var scanner;
    beforeEach(function () {
      scanner = new Scanner('a b c');
    });

    describe('scan', function () {
      describe('when the RegExp matches the entire string', function () {
        it('returns the entire string', function () {
          var match = scanner.scan(/a b c/);
          assert.equal(match, scanner.string);
          assert(scanner.eos());
        });
      });

      describe('when the RegExp matches at index 0', function () {
        it('returns the portion of the string that matched', function () {
          var match = scanner.scan(/a/);
          assert.equal(match, 'a');
          assert.equal(scanner.pos, 1);
        });
      });

      describe('when the RegExp matches at some index other than 0', function () {
        it('returns the empty string', function () {
          var match = scanner.scan(/b/);
          assert.equal(match, '');
          assert.equal(scanner.pos, 0);
        });
      });

      describe('when the RegExp does not match', function () {
        it('returns the empty string', function () {
          var match = scanner.scan(/z/);
          assert.equal(match, '');
          assert.equal(scanner.pos, 0);
        });
      });
    }); // scan

    describe('scanUntil', function () {
      describe('when the RegExp matches at index 0', function () {
        it('returns the empty string', function () {
          var match = scanner.scanUntil(/a/);
          assert.equal(match, '');
          assert.equal(scanner.pos, 0);
        });
      });

      describe('when the RegExp matches at some index other than 0', function () {
        it('returns the string up to that index', function () {
          var match = scanner.scanUntil(/b/);
          assert.equal(match, 'a ');
          assert.equal(scanner.pos, 2);
        });
      });

      describe('when the RegExp does not match', function () {
        it('returns the entire string', function () {
          var match = scanner.scanUntil(/z/);
          assert.equal(match, scanner.string);
          assert(scanner.eos());
        });
      });
    }); // scanUntil
  }); // for a non-empty string
});
