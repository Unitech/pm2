require('./helper');
var Writer = Mustache.Writer;

describe('A new Mustache.Writer', function () {
  var writer;
  beforeEach(function () {
    writer = new Writer;
  });

  it('loads partials correctly', function () {
    var partial = 'The content of the partial.';
    var result = writer.render('{{>partial}}', {}, function (name) {
      assert.equal(name, 'partial');
      return partial;
    });

    assert.equal(result, partial);
  });

  it('caches partials by content, not name', function () {
    var result = writer.render('{{>partial}}', {}, {
      partial: 'partial one'
    });

    assert.equal(result, 'partial one');

    result = writer.render('{{>partial}}', {}, {
      partial: 'partial two'
    });

    assert.equal(result, 'partial two');
  });

  it('can compile an array of tokens', function () {
    var template = 'Hello {{name}}!';
    var tokens = Mustache.parse(template);
    var render = writer.compileTokens(tokens, template);

    var result = render({ name: 'Michael' });

    assert.equal(result, 'Hello Michael!');
  });
});
