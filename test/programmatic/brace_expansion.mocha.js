/**
 * modules/chokidar/lib/brace-expand.js: bounded replacement of braces.expand
 * (GHSA-vfj7-8cjw-p6xm) in the vendored chokidar.
 * Reference: braces@3.0.3, installed with the chokidar devDependency.
 */

var should = require('should');
var fs     = require('fs');
var path   = require('path');

var ROOT = path.join(__dirname, '../..');
var expand = require('../../modules/chokidar/lib/brace-expand');
var braces = require(require.resolve('braces', {
  paths: [path.dirname(require.resolve('chokidar', { paths: [ROOT] }))]
}));

// generous for slow CI, real cost is a few ms at most
var MAX_PATHOLOGICAL_MS = 50;
var WELL_FORMED_CASES = 20000;
var RANDOM_CASES = 10000;
var MAX_RANDOM_LENGTH = 16;

// deterministic xorshift, so a failure always reproduces
function prng(seed) {
  return function() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}

function reference(pattern) {
  try {
    return braces.expand(pattern);
  } catch (e) {
    return e;
  }
}

function timed(pattern) {
  var start = process.hrtime.bigint();
  var result = expand(pattern);
  return { result: result, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

function sample(failures) {
  return JSON.stringify(failures.slice(0, 5)).slice(0, 2000);
}

/**
 * Supported grammar generator: alternatives (nested up to MAX_DEPTH, empty
 * items), numeric ranges (sign, multi digit, zero padding, signed / padded
 * step), letter ranges, opaque `[...]` / `(...)` chunks and unicode literals.
 * Tracks the expansion count so braces is never run on a huge pattern.
 */
var LITERAL_CHARS = 'abcxyz/*-_?!+@|\u00e9\u4e2d';
// brace-free brackets / parens: literal text for braces
var OPAQUE_CHUNKS = ['[a-z]', '[!a]', '(x86)', '@(js|ts)', '!(a)', ' (P)', '[jt]'];
var BOUNDS = ['0', '1', '2', '3', '5', '9', '10', '12', '100'];
var NEST_DECAY = 0.75;
var DEEP_WRAP = 0.7;

function wellFormed(rnd) {
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  function int(max) { return Math.floor(rnd() * max); }
  // no `.` in items: `..` inside an alternation is unsupported (null)
  function literal() {
    var out = '';
    for (var i = int(4); i > 0; i--) out += rnd() < 0.1 ? pick(OPAQUE_CHUNKS) : pick(LITERAL_CHARS);
    return out;
  }
  function bound() {
    return (rnd() < 0.2 ? '-' : '') + (rnd() < 0.3 ? '0' : '') + pick(BOUNDS);
  }
  function step() {
    if (rnd() >= 0.3) return null;
    return (rnd() < 0.2 ? '-' : '') + (rnd() < 0.3 ? '0' : '') + int(4);
  }
  // depth: enclosing groups, the scanner allows MAX_DEPTH
  function seq(depth) {
    var pattern = '';
    var count = 1;
    var deepest = depth;
    for (var i = 1 + int(2); i > 0 && count <= expand.MAX_EXPANSIONS; i--) {
      pattern += literal();
      var r = rnd();
      // ranges are groups too
      if (depth >= expand.MAX_DEPTH) continue;
      if (r < 0.35 * Math.pow(NEST_DECAY, depth)) {
        var items = [];
        var sum = 0;
        for (var j = 2 + int(2); j > 0; j--) {
          var item = rnd() < 0.15 ? { pattern: '', count: 1, depth: depth + 1 } : seq(depth + 1);
          items.push(item.pattern);
          sum += item.count;
          deepest = Math.max(deepest, item.depth);
        }
        pattern += '{' + items.join(',') + '}';
        count *= sum;
      } else if (r < 0.55) {
        var from = bound();
        var to = bound();
        var by = step();
        pattern += '{' + from + '..' + to + (by === null ? '' : '..' + by) + '}';
        count *= Math.floor(Math.abs(+to - +from) / (Math.abs(+by) || 1)) + 1;
        deepest = Math.max(deepest, depth + 1);
      } else if (r < 0.65) {
        var a = pick('abcxyzAZ');
        var b = pick('abcxyzAZ');
        var letterStep = rnd() < 0.3 ? 1 + int(4) : 0;
        pattern += '{' + a + '..' + b + (letterStep ? '..' + letterStep : '') + '}';
        count *= Math.floor(Math.abs(b.charCodeAt(0) - a.charCodeAt(0)) / (letterStep || 1)) + 1;
        deepest = Math.max(deepest, depth + 1);
      }
    }
    return { pattern: pattern, count: count, depth: deepest };
  }
  var root = seq(0);
  // deep nesting is rare above: wrap in alternatives up to MAX_DEPTH
  while (root.depth < expand.MAX_DEPTH && rnd() < DEEP_WRAP) {
    root = { pattern: literal() + '{' + literal() + ',' + root.pattern + '}', count: root.count + 1, depth: root.depth + 1 };
  }
  // relative parent paths are fine at top level
  if (rnd() < 0.2) root.pattern = '../' + root.pattern;
  return root;
}

describe('Vendored chokidar brace expansion', function() {

  describe('parity with braces@3.0.3', function() {
    it('reference is braces 3.0.3', function() {
      require(path.join(path.dirname(require.resolve('braces', {
        paths: [path.dirname(require.resolve('chokidar', { paths: [ROOT] }))]
      })), 'package.json')).version.should.equal('3.0.3');
    });

    it('supported grammar: never null, identical to braces', function() {
      this.timeout(20000);
      var rnd = prng(42);
      var checked = 0;
      var failures = [];
      for (var i = 0; i < WELL_FORMED_CASES; i++) {
        var gen = wellFormed(rnd);
        if (!gen.pattern || gen.count > expand.MAX_EXPANSIONS) continue;
        checked++;
        var got = expand(gen.pattern);
        var expected = reference(gen.pattern);
        if (got === null || JSON.stringify(got) !== JSON.stringify(expected)) {
          failures.push({ pattern: gen.pattern, expected: expected, got: got });
        }
      }
      checked.should.be.above(WELL_FORMED_CASES / 2);
      failures.should.eql([], sample(failures));
    });

    it('random input (escapes, quotes, $, brackets, parens, dots, unicode): null or identical', function() {
      this.timeout(20000);
      // strings pick chars, arrays pick tokens
      var alphabets = [
        '{},..ab12-/*',
        '{},..ab12-\\"[]$/()\'`',
        '{},..aZ09-+|!@',
        '{},.ab\u00e9\u00a0\ufeffx',
        '{},..a1()[]$!@|',
        ['{', '}', ',', '..', 'a', '1', '/', '(', ')', '[', ']', '$', '${', '(a|b)', '[a-z]',
          '!(', '@(', '[!a]', '[[:alpha:]]', '{a,b}', '{1..3}'],
        ['/Users/me/Dropbox (Personal)/', 'C:/Program Files (x86)/', 'app/(group)/', '$app/',
          '{src,lib}', '{a,{b,c}}', '/**', '/*.[jt]s', '/*.@(js|ts)', '{1..3}', '(', '[', ',', '}']
      ];
      var rnd = prng(7);
      var failures = [];
      alphabets.forEach(function(alphabet) {
        for (var i = 0; i < RANDOM_CASES; i++) {
          var pattern = '';
          for (var len = 1 + Math.floor(rnd() * MAX_RANDOM_LENGTH); len > 0; len--) {
            pattern += alphabet[Math.floor(rnd() * alphabet.length)];
          }
          var got = expand(pattern);
          // non null results are bounded, so braces is safe to run here
          if (got === null) continue;
          var expected = reference(pattern);
          if (JSON.stringify(got) !== JSON.stringify(expected)) {
            failures.push({ pattern: pattern, expected: expected, got: got });
          }
        }
      });
      failures.should.eql([], sample(failures));
    });

    it('patterns that make braces throw return null', function() {
      ['{1..1001}', 'a'.repeat(10001) + '{a,b}', '({!1(-1){1'].forEach(function(pattern) {
        reference(pattern).should.be.instanceOf(Error);
        should(expand(pattern)).be.null();
      });
    });
  });

  describe('grammar', function() {
    it('expands pm2 style globs', function() {
      expand('src/{a,b}/**/*.js').should.eql(['src/a/**/*.js', 'src/b/**/*.js']);
      expand('{src,lib}/**/*.{js,ts}').should.eql(['src/**/*.js', 'src/**/*.ts', 'lib/**/*.js', 'lib/**/*.ts']);
      expand('../shared/{a,b}').should.eql(['../shared/a', '../shared/b']);
      expand('logs/app-{1..3}.log').should.eql(['logs/app-1.log', 'logs/app-2.log', 'logs/app-3.log']);
    });

    it('cartesian product is left-major, no dedupe, empty items', function() {
      expand('a{b,c}d{e,f}').should.eql(['abde', 'abdf', 'acde', 'acdf']);
      expand('{a,a}').should.eql(['a', 'a']);
      expand('a{,b}c').should.eql(['ac', 'abc']);
      expand('a/{b,{c,d}}/e').should.eql(['a/b/e', 'a/c/e', 'a/d/e']);
    });

    it('ranges: step, reversed, zero step, padding with sign, letters', function() {
      expand('{1..10..-3}').should.eql(['1', '4', '7', '10']);
      expand('{3..1}').should.eql(['3', '2', '1']);
      expand('{1..3..0}').should.eql(['1', '2', '3']);
      expand('{-01..2}').should.eql(['-01', '000', '001', '002']);
      expand('{1..10..02}').should.eql(['01', '03', '05', '07', '09']);
      expand('{1..10..003}').should.eql(['001', '004', '007', '010']);
      expand('{a..e..2}').should.eql(['a', 'c', 'e']);
      expand('{Z..a}').should.eql(['Z', '[', '\\', ']', '^', '_', '`', 'a']);
    });

    it('brace-free brackets / parens and $ are literal, identical to braces', function() {
      [
        ['/Users/me/Dropbox (Personal)/app/{src,lib}/**', [
          '/Users/me/Dropbox (Personal)/app/src/**', '/Users/me/Dropbox (Personal)/app/lib/**']],
        ['C:/Program Files (x86)/app/{a,b}', ['C:/Program Files (x86)/app/a', 'C:/Program Files (x86)/app/b']],
        ['app/(group)/{a,b}', ['app/(group)/a', 'app/(group)/b']],
        ['{src,lib}/*.[jt]s', ['src/*.[jt]s', 'lib/*.[jt]s']],
        ['{src,lib}/*.@(js|ts)', ['src/*.@(js|ts)', 'lib/*.@(js|ts)']],
        ['$app/{a,b}', ['$app/a', '$app/b']],
        ['{(a),[b]}', ['(a)', '[b]']]
      ].forEach(function(test) {
        expand(test[0]).should.eql(test[1]);
        expand(test[0]).should.eql(reference(test[0]));
      });
    });

    it('returns null on braces-specific syntax (pruning disabled)', function() {
      [
        'C:\\src\\{a,b}', '"{a,b}"', "'{a,b}'", '`{a,b}`', '${a,b}', 'a/${b}/{c,d}',
        '[{a,b}]', '+(a|{b,c})', '(a|{b,c})', 'a(b{c,d}', 'a[b{c,d}', 'a)b{c,d}', 'a]b{c,d}',
        '[[:alpha:]]{a,b}', '[a.b]{c,d}', '(a,b){c,d}', "/Users/me/O'Brien/{a,b}",
        'a{b}c', 'a{}b', '{a,{b}}', '{{a,b}}', '{1.5..3}', '{a..3}', '{a..b,c}',
        'a{b,c', 'a}b{c,d}', ''
      ].forEach(function(pattern) {
        should.strictEqual(expand(pattern), null, pattern);
      });
    });

    it('is identity without braces', function() {
      expand('src/**/*.js').should.eql(['src/**/*.js']);
    });

    it('never throws on non string input', function() {
      [undefined, null, 1, {}, []].forEach(function(input) {
        should(expand(input)).be.null();
      });
    });
  });

  describe('limits', function() {
    it('exports named limits', function() {
      expand.MAX_PATTERN_LENGTH.should.equal(10000);
      expand.MAX_DEPTH.should.equal(10);
      expand.MAX_EXPANSIONS.should.equal(256);
      expand.MAX_OUTPUT_CHARS.should.equal(1e6);
    });

    it('depth: MAX_DEPTH ok, +1 null', function() {
      var n = expand.MAX_DEPTH;
      expand('{a,'.repeat(n) + 'b' + '}'.repeat(n)).should.have.length(n + 1);
      should(expand('{a,'.repeat(n + 1) + 'b' + '}'.repeat(n + 1))).be.null();
    });

    it('expansions: MAX_EXPANSIONS ok, +1 null', function() {
      var n = expand.MAX_EXPANSIONS;
      expand('{1..' + n + '}').should.have.length(n);
      should(expand('{1..' + (n + 1) + '}')).be.null();
      expand('{a,b}'.repeat(Math.log2(n))).should.have.length(n);
      should(expand('{a,b}'.repeat(Math.log2(n) + 1))).be.null();
      var alternatives = [];
      for (var i = 0; i <= n; i++) alternatives.push('x' + i);
      should(expand('{' + alternatives.join(',') + '}')).be.null();
      expand('{' + alternatives.slice(0, n).join(',') + '}').should.have.length(n);
    });

    it('huge ranges: null without allocating', function() {
      [
        '{1..999999999}', '{1..99999999999999999999}', '{9007199254740992..9007199254740994}',
        '{a..z..0}'.repeat(3)
      ].forEach(function(pattern) {
        var res = timed(pattern);
        should(res.result).be.null();
        res.ms.should.be.below(MAX_PATHOLOGICAL_MS);
      });
    });

    it('pattern length: MAX_PATTERN_LENGTH ok, +1 null', function() {
      var tail = '{b,c}';
      var pad = expand.MAX_PATTERN_LENGTH - tail.length;
      expand('a'.repeat(pad) + tail).should.have.length(2);
      should(expand('a'.repeat(pad + 1) + tail)).be.null();
    });

    it('output chars: MAX_OUTPUT_CHARS ok, +1 expansion char null', function() {
      var n = expand.MAX_EXPANSIONS;
      var alts = '{a,b}'.repeat(Math.log2(n));
      var each = Math.floor(expand.MAX_OUTPUT_CHARS / n);
      var ok = alts + 'x'.repeat(each - Math.log2(n));
      expand(ok).should.have.length(n);
      should(expand(ok + 'x')).be.null();
    });

    it('pathological patterns: fast, no stack overflow, never throw', function() {
      [
        '{'.repeat(4999) + 'x' + '}'.repeat(4999),
        '{a,'.repeat(3000) + 'b' + '}'.repeat(3000),
        '{a,b}'.repeat(40),
        '{1..200}'.repeat(5),
        '['.repeat(9000) + '{a,b}',
        '{' + 'a,'.repeat(4990) + 'b}',
        '{a..z}'.repeat(10)
      ].forEach(function(pattern) {
        var res = timed(pattern);
        should.strictEqual(res.result, null, pattern.slice(0, 20));
        res.ms.should.be.below(MAX_PATHOLOGICAL_MS, pattern.slice(0, 20));
      });
    });
  });

  describe('vendored chokidar wiring', function() {
    it('index.js uses brace-expand, not braces', function() {
      var src = fs.readFileSync(path.join(ROOT, 'modules/chokidar/index.js'), 'utf8');
      src.should.not.match(/require\(\s*['"]braces['"]\s*\)/);
      src.should.match(/require\('\.\/lib\/brace-expand'\)/);
    });

    it('brace-expand.js has no dependency', function() {
      var src = fs.readFileSync(path.join(ROOT, 'modules/chokidar/lib/brace-expand.js'), 'utf8');
      src.should.not.match(/require\(/);
    });
  });
});
