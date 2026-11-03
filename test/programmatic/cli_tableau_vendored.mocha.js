/**
 * modules/cli-tableau: vendored cli-tableau 2.0.1 with ansis and a prototype
 * pollution guard. Differential tests against upstream cli-tableau 2.0.1
 * (devDependency, test reference only: the guards below make sure pm2 code
 * never requires it).
 */

var should = require('should');
var fs     = require('fs');
var path   = require('path');

var ROOT = path.join(__dirname, '../..');
var VENDORED_DIR = path.join(ROOT, 'modules/cli-tableau');
var UPSTREAM_VERSION = '2.0.1';

var Table = require('../../modules/cli-tableau');
var Upstream = require('cli-tableau');
var UPSTREAM_DIR = path.dirname(require.resolve('cli-tableau/package.json'));

var ansis = require('ansis');

// chalk and ansis close nested styles differently: compare what is printed
function strip(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function render(Ctor, scenario) {
  var table = new Ctor(scenario.options());
  scenario.rows().forEach(function(row) { table.push(row); });
  return table.toString();
}

// options mirror the pm2 call sites (lib/API/UX, lib/API/pm2-plus)
var PM2_STYLE = function() { return { 'padding-left' : 1, head : ['cyan', 'bold'], compact : true }; };

var SCENARIOS = [{
  title: 'pm2 ls: head, colWidths, compact, truncation, styled cells',
  options: function() { return { head: ['id', 'name', 'status'], colWidths: [5, 12, 10], style: PM2_STYLE() }; },
  rows: function() {
    return [
      [ansis.bold.cyan('0'), 'a-very-long-application-name', ansis.green.bold('online')],
      ['1', 'api', ansis.red.bold('stopped')]
    ];
  }
}, {
  title: 'pm2 describe: vertical table',
  options: function() { return { style: PM2_STYLE() }; },
  rows: function() {
    return [{ status: ansis.green.bold('online') }, { name: 'api' }, { 'script args': 'N/A' }];
  }
}, {
  title: 'cross table',
  options: function() { return { head: ['', 'cpu', 'mem'] }; },
  rows: function() { return [{ api: ['1%', '40mb'] }, { web: ['0%', '12mb'] }]; }
}, {
  title: 'defaults (red head, gray border)',
  options: function() { return { head: ['a', 'b'] }; },
  rows: function() { return [['1', '2'], ['three', 4], [null, undefined]]; }
}, {
  title: 'aligns, padding, multiline and text objects',
  options: function() {
    return {
      head: ['left', 'middle', 'right'],
      colAligns: ['left', 'middle', 'right'],
      style: { 'padding-left': 2, 'padding-right': 2 }
    };
  },
  rows: function() { return [['x', 'line1\nline2', { text: 'obj' }], ['long cell value', 'y', 'z']]; }
}, {
  title: 'borders false',
  options: function() { return { borders: false, head: ['a', 'b'] }; },
  rows: function() { return [['1', '2']]; }
}, {
  title: 'custom chars',
  options: function() { return { chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }, head: ['a'] }; },
  rows: function() { return [['1'], ['2']]; }
}, {
  title: 'empty table',
  options: function() { return {}; },
  rows: function() { return []; }
}];

// one key per way an own key can reach Object.prototype through options()
var POLLUTIONS = [
  '{"__proto__":{"polluted":"yes"}}',
  '{"constructor":{"prototype":{"polluted":"yes"}}}',
  '{"style":{"__proto__":{"polluted":"yes"}}}',
  '{"chars":{"__proto__":{"polluted":"yes"}}}'
];

function listFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function(entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test') return;
      return listFiles(full, out);
    }
    if (/\.(c|m)?js$/.test(entry.name)) out.push(full);
  });
  return out;
}

describe('Vendored cli-tableau', function() {

  describe('prototype pollution', function() {
    afterEach(function() {
      delete Object.prototype.polluted;
    });

    POLLUTIONS.forEach(function(json) {
      it('ignores ' + json, function() {
        var table = new Table(JSON.parse(json));
        table.push(['a']);
        table.toString();
        should(({}).polluted).be.undefined();
      });
    });

    it('still merges nested options', function() {
      var table = new Table(JSON.parse('{"style":{"head":["cyan"],"compact":true}}'));
      table.options.style.head.should.eql(['cyan']);
      table.options.style.compact.should.be.true();
      table.options.style.border.should.eql(['gray']);
    });
  });

  describe('differential rendering vs upstream cli-tableau ' + UPSTREAM_VERSION, function() {
    SCENARIOS.forEach(function(scenario) {
      it(scenario.title, function() {
        strip(render(Table, scenario)).should.equal(strip(render(Upstream, scenario)));
      });
    });
  });

  describe('guards', function() {
    // require(), require.resolve(), import() and static import of cli-tableau/chalk (or subpaths)
    var VENDORED_REQUIRE = /(require(\.resolve)?|import)\(\s*['"](cli-tableau|chalk)(\/[^'"]*)?['"]|from\s+['"](cli-tableau|chalk)(\/[^'"]*)?['"]/;

    it('pm2 code never requires cli-tableau or chalk from node_modules', function() {
      var files = listFiles(path.join(ROOT, 'lib'), [])
        .concat(listFiles(path.join(ROOT, 'modules'), []))
        .concat(fs.readdirSync(path.join(ROOT, 'bin')).map(function(f) { return path.join(ROOT, 'bin', f); }))
        .concat([path.join(ROOT, 'index.js'), path.join(ROOT, 'constants.js'), path.join(ROOT, 'paths.js')]);
      files.length.should.be.above(50);
      var offenders = files.filter(function(file) {
        return VENDORED_REQUIRE.test(fs.readFileSync(file, 'utf8'));
      }).map(function(file) { return path.relative(ROOT, file); });
      offenders.should.eql([]);
    });

    it('package.json: cli-tableau only as devDependency, no chalk', function() {
      var pkg = require('../../package.json');
      should(pkg.dependencies['cli-tableau']).be.undefined();
      should(pkg.dependencies.chalk).be.undefined();
      pkg.devDependencies['cli-tableau'].should.equal(UPSTREAM_VERSION);
      require(path.join(UPSTREAM_DIR, 'package.json')).version.should.equal(UPSTREAM_VERSION);
    });

    it('LICENSE is byte-identical', function() {
      fs.readFileSync(path.join(VENDORED_DIR, 'LICENSE'))
        .equals(fs.readFileSync(path.join(UPSTREAM_DIR, 'LICENSE'))).should.be.true();
    });

    it('index.js and utils.js are upstream plus the documented patch only', function() {
      // file: [vendored, upstream] hunks, see modules/cli-tableau/VENDORED.md
      var PATCHES = {
        'index.js': [
          ["var colors = require('ansis')", "var colors = require('chalk')"],
          ["border: ['gray'],", "border: ['grey'],"]
        ],
        'utils.js': [
          ["    // an own __proto__ key (JSON.parse) would recurse into Object.prototype\n" +
           "    if (p === '__proto__' || p === 'constructor' || p === 'prototype') {\n" +
           "      continue\n" +
           "    }\n", '']
        ]
      };
      Object.keys(PATCHES).forEach(function(file) {
        var src = fs.readFileSync(path.join(VENDORED_DIR, file), 'utf8');
        PATCHES[file].forEach(function(hunk) {
          src.split(hunk[0]).length.should.equal(2, hunk[0]);
          src = src.replace(hunk[0], hunk[1]);
        });
        src.should.equal(fs.readFileSync(path.join(UPSTREAM_DIR, 'lib', file), 'utf8'), file);
      });
    });

    it('has no package.json (SBOM scanners would report cli-tableau)', function() {
      fs.existsSync(path.join(VENDORED_DIR, 'package.json')).should.be.false();
    });
  });
});
