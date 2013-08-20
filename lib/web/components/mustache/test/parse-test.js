require('./helper');

// A map of templates to their expected token output. Tokens are in the format:
// [type, value, startIndex, endIndex, subTokens].
var expectations = {
  ''                                        : [],
  '{{hi}}'                                  : [ [ 'name', 'hi', 0, 6 ] ],
  '{{hi.world}}'                            : [ [ 'name', 'hi.world', 0, 12 ] ],
  '{{hi . world}}'                          : [ [ 'name', 'hi . world', 0, 14 ] ],
  '{{ hi}}'                                 : [ [ 'name', 'hi', 0, 7 ] ],
  '{{hi }}'                                 : [ [ 'name', 'hi', 0, 7 ] ],
  '{{ hi }}'                                : [ [ 'name', 'hi', 0, 8 ] ],
  '{{{hi}}}'                                : [ [ '&', 'hi', 0, 8 ] ],
  '{{!hi}}'                                 : [ [ '!', 'hi', 0, 7 ] ],
  '{{! hi}}'                                : [ [ '!', 'hi', 0, 8 ] ],
  '{{! hi }}'                               : [ [ '!', 'hi', 0, 9 ] ],
  '{{ !hi}}'                                : [ [ '!', 'hi', 0, 8 ] ],
  '{{ ! hi}}'                               : [ [ '!', 'hi', 0, 9 ] ],
  '{{ ! hi }}'                              : [ [ '!', 'hi', 0, 10 ] ],
  'a\n b'                                   : [ [ 'text', 'a\n b', 0, 4 ] ],
  'a{{hi}}'                                 : [ [ 'text', 'a', 0, 1 ], [ 'name', 'hi', 1, 7 ] ],
  'a {{hi}}'                                : [ [ 'text', 'a ', 0, 2 ], [ 'name', 'hi', 2, 8 ] ],
  ' a{{hi}}'                                : [ [ 'text', ' a', 0, 2 ], [ 'name', 'hi', 2, 8 ] ],
  ' a {{hi}}'                               : [ [ 'text', ' a ', 0, 3 ], [ 'name', 'hi', 3, 9 ] ],
  'a{{hi}}b'                                : [ [ 'text', 'a', 0, 1 ], [ 'name', 'hi', 1, 7 ], [ 'text', 'b', 7, 8 ] ],
  'a{{hi}} b'                               : [ [ 'text', 'a', 0, 1 ], [ 'name', 'hi', 1, 7 ], [ 'text', ' b', 7, 9 ] ],
  'a{{hi}}b '                               : [ [ 'text', 'a', 0, 1 ], [ 'name', 'hi', 1, 7 ], [ 'text', 'b ', 7, 9 ] ],
  'a\n{{hi}} b \n'                          : [ [ 'text', 'a\n', 0, 2 ], [ 'name', 'hi', 2, 8 ], [ 'text', ' b \n', 8, 12 ] ],
  'a\n {{hi}} \nb'                          : [ [ 'text', 'a\n ', 0, 3 ], [ 'name', 'hi', 3, 9 ], [ 'text', ' \nb', 9, 12 ] ],
  'a\n {{!hi}} \nb'                         : [ [ 'text', 'a\n', 0, 2 ], [ '!', 'hi', 3, 10 ], [ 'text', 'b', 12, 13 ] ],
  'a\n{{#a}}{{/a}}\nb'                      : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 2, 8, [], 8 ], [ 'text', 'b', 15, 16 ] ],
  'a\n {{#a}}{{/a}}\nb'                     : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 9 ], [ 'text', 'b', 16, 17 ] ],
  'a\n {{#a}}{{/a}} \nb'                    : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 9 ], [ 'text', 'b', 17, 18 ] ],
  'a\n{{#a}}\n{{/a}}\nb'                    : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 2, 8, [], 9 ], [ 'text', 'b', 16, 17 ] ],
  'a\n {{#a}}\n{{/a}}\nb'                   : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 10 ], [ 'text', 'b', 17, 18 ] ],
  'a\n {{#a}}\n{{/a}} \nb'                  : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 10 ], [ 'text', 'b', 18, 19 ] ],
  'a\n{{#a}}\n{{/a}}\n{{#b}}\n{{/b}}\nb'    : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 2, 8, [], 9 ], [ '#', 'b', 16, 22, [], 23 ], [ 'text', 'b', 30, 31 ] ],
  'a\n {{#a}}\n{{/a}}\n{{#b}}\n{{/b}}\nb'   : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 10 ], [ '#', 'b', 17, 23, [], 24 ], [ 'text', 'b', 31, 32 ] ],
  'a\n {{#a}}\n{{/a}}\n{{#b}}\n{{/b}} \nb'  : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [], 10 ], [ '#', 'b', 17, 23, [], 24 ], [ 'text', 'b', 32, 33 ] ],
  'a\n{{#a}}\n{{#b}}\n{{/b}}\n{{/a}}\nb'    : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 2, 8, [ [ '#', 'b', 9, 15, [], 16 ] ], 23 ], [ 'text', 'b', 30, 31 ] ],
  'a\n {{#a}}\n{{#b}}\n{{/b}}\n{{/a}}\nb'   : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [ [ '#', 'b', 10, 16, [], 17 ] ], 24 ], [ 'text', 'b', 31, 32 ] ],
  'a\n {{#a}}\n{{#b}}\n{{/b}}\n{{/a}} \nb'  : [ [ 'text', 'a\n', 0, 2 ], [ '#', 'a', 3, 9, [ [ '#', 'b', 10, 16, [], 17 ] ], 24 ], [ 'text', 'b', 32, 33 ] ],
  '{{>abc}}'                                : [ [ '>', 'abc', 0, 8 ] ],
  '{{> abc }}'                              : [ [ '>', 'abc', 0, 10 ] ],
  '{{ > abc }}'                             : [ [ '>', 'abc', 0, 11 ] ],
  '{{=<% %>=}}'                             : [ [ '=', '<% %>', 0, 11 ] ],
  '{{= <% %> =}}'                           : [ [ '=', '<% %>', 0, 13 ] ],
  '{{=<% %>=}}<%={{ }}=%>'                  : [ [ '=', '<% %>', 0, 11 ], [ '=', '{{ }}', 11, 22 ] ],
  '{{=<% %>=}}<%hi%>'                       : [ [ '=', '<% %>', 0, 11 ], [ 'name', 'hi', 11, 17 ] ],
  '{{#a}}{{/a}}hi{{#b}}{{/b}}\n'            : [ [ '#', 'a', 0, 6, [], 6 ], [ 'text', 'hi', 12, 14 ], [ '#', 'b', 14, 20, [], 20 ], [ 'text', '\n', 26, 27 ] ],
  '{{a}}\n{{b}}\n\n{{#c}}\n{{/c}}\n'        : [ [ 'name', 'a', 0, 5 ], [ 'text', '\n', 5, 6 ], [ 'name', 'b', 6, 11 ], [ 'text', '\n\n', 11, 13 ], [ '#', 'c', 13, 19, [], 20 ] ],
  '{{#foo}}\n  {{#a}}\n    {{b}}\n  {{/a}}\n{{/foo}}\n'
                                            : [ [ '#', 'foo', 0, 8, [ [ '#', 'a', 11, 17, [ [ 'text', '    ', 18, 22 ], [ 'name', 'b', 22, 27 ], [ 'text', '\n', 27, 28 ] ], 30 ] ], 37 ] ]
};

describe('Mustache.parse', function () {

  for (var template in expectations) {
    (function (template, tokens) {
      it('knows how to parse ' + JSON.stringify(template), function () {
        assert.deepEqual(Mustache.parse(template), tokens);
      });
    })(template, expectations[template]);
  }

  describe('when there is an unclosed tag', function () {
    it('throws an error', function () {
      assert.throws(function () {
        Mustache.parse('My name is {{name');
      }, /unclosed tag at 17/i);
    });
  });

  describe('when there is an unclosed section', function () {
    it('throws an error', function () {
      assert.throws(function () {
        Mustache.parse('A list: {{#people}}{{name}}');
      }, /unclosed section "people" at 27/i);
    });
  });

  describe('when there is an unopened section', function () {
    it('throws an error', function () {
      assert.throws(function () {
        Mustache.parse('The end of the list! {{/people}}');
      }, /unopened section "people" at 21/i);
    });
  });

  describe('when invalid tags are given as an argument', function () {
    it('throws an error', function () {
      assert.throws(function () {
        Mustache.parse('A template <% name %>', [ '<%' ]);
      }, /invalid tags/i);
    });
  });

  describe('when the template contains invalid tags', function () {
    it('throws an error', function () {
      assert.throws(function () {
        Mustache.parse('A template {{=<%=}}');
      }, /invalid tags at 11/i);
    });
  });

});
