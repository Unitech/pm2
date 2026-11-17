/**
 * Issue #5187 — `pm2 monit` used to start with an empty log pane and only
 * showed lines emitted after launch, capped at 200 lines shared by all
 * processes. It now preloads the last N lines (out + err merged) of every
 * process from its log files, N = 200 by default or `--lines <n>`.
 *
 * These tests exercise the pure parts (no blessed screen): the buffer
 * logic of Dashboard, the out/err merge and the safe file tail reader.
 */

process.env.NODE_ENV = 'test';

var fs        = require('fs');
var path      = require('path');
var os        = require('os');
var should    = require('should');
var Dashboard = require('../../lib/API/Dashboard');
var Log       = require('../../lib/API/Log');

function proc(pm_id, name) {
  return { pm_id: pm_id, name: name };
}

function packet(pm_id, name, data) {
  return { process: { pm_id: pm_id, name: name }, data: data };
}

describe('Dashboard log history (#5187)', function() {

  beforeEach(function() {
    Dashboard.logLines = {};
    Dashboard.maxLines = Dashboard.parseLines(undefined);
  });

  describe('parseLines', function() {
    it('should default to 200', function() {
      Dashboard.parseLines(undefined).should.eql(200);
      Dashboard.parseLines(null).should.eql(200);
      Dashboard.parseLines('').should.eql(200);
    });

    it('should accept a positive integer (string or number)', function() {
      Dashboard.parseLines('50').should.eql(50);
      Dashboard.parseLines(1000).should.eql(1000);
    });

    it('should fall back to the default on garbage or non-positive values', function() {
      Dashboard.parseLines('abc').should.eql(200);
      Dashboard.parseLines('0').should.eql(200);
      Dashboard.parseLines(-3).should.eql(200);
    });

    it('should cap absurd values to protect memory and the UI', function() {
      Dashboard.parseLines(100000).should.eql(10000);
    });
  });

  describe('log buffer', function() {
    it('should keep at most maxLines per process, dropping the oldest', function() {
      Dashboard.maxLines = 5;
      for (var i = 0; i < 12; i++)
        Dashboard.log('out', packet(0, 'app', 'line ' + i));

      Dashboard.logLines[0].length.should.eql(5);
      Dashboard.logLines[0][0].should.match(/line 7$/);
      Dashboard.logLines[0][4].should.match(/line 11$/);
    });

    it('should not let a verbose process evict the lines of another process', function() {
      Dashboard.maxLines = 10;
      Dashboard.log('out', packet(1, 'quiet', 'hello'));
      for (var i = 0; i < 100; i++)
        Dashboard.log('out', packet(2, 'chatty', 'noise ' + i));

      Dashboard.logLines[1].length.should.eql(1);
      Dashboard.logLines[1][0].should.match(/hello$/);
      Dashboard.logLines[2].length.should.eql(10);
    });

    it('should split multi-line packets and skip empty lines', function() {
      Dashboard.log('err', packet(3, 'app', 'a\nb\n\nc\n'));
      Dashboard.logLines[3].length.should.eql(3);
      Dashboard.logLines[3][0].should.match(/^\{red-fg\}app\{\/\} > a$/);
    });

    it('should tolerate packets without data', function() {
      Dashboard.log('out', { process: { pm_id: 4, name: 'app' } });
      should(Dashboard.logLines[4]).be.undefined();
    });
  });

  describe('mergeLogLines', function() {
    it('should put out first then err when lines carry no timestamp', function() {
      var merged = Dashboard.mergeLogLines(['o1', 'o2'], ['e1']);
      merged.map(function(e) { return e.type + ':' + e.line; })
        .should.eql(['out:o1', 'out:o2', 'err:e1']);
    });

    it('should interleave chronologically when every line is timestamped', function() {
      var merged = Dashboard.mergeLogLines(
        ['2026-08-28T10:00:01: o1', '2026-08-28T10:00:03: o2'],
        ['2026-08-28T10:00:02: e1', '2026-08-28T10:00:04: e2']
      );
      merged.map(function(e) { return e.type; }).should.eql(['out', 'err', 'out', 'err']);
    });

    it('should support the default pm2 log_date_format (YYYY-MM-DD HH:mm:ss Z)', function() {
      var merged = Dashboard.mergeLogLines(
        ['2026-08-28 10:00:02 +02:00: o1'],
        ['2026-08-28 10:00:01 +02:00: e1']
      );
      merged.map(function(e) { return e.type; }).should.eql(['err', 'out']);
    });

    it('should keep continuation lines (stack traces) attached to their timestamped line', function() {
      var merged = Dashboard.mergeLogLines(
        ['2026-08-28T10:00:01: o1', '2026-08-28T10:00:09: o2'],
        ['2026-08-28T10:00:05: Error: boom', '    at foo (app.js:1:1)', '    at bar (app.js:2:2)']
      );
      merged.map(function(e) { return e.type + ':' + e.line.trim().slice(0, 6); })
        .should.eql(['out:2026-0', 'err:2026-0', 'err:at foo', 'err:at bar', 'out:2026-0']);
      merged[1].line.should.match(/boom$/);
      merged[4].line.should.match(/o2$/);
    });

    it('should fall back to out-then-err when one stream has no timestamp at all', function() {
      var merged = Dashboard.mergeLogLines(
        ['2026-08-28T10:00:05: o1'],
        ['plain error', 'another']
      );
      merged.map(function(e) { return e.type; }).should.eql(['out', 'err', 'err']);
    });

    it('should emit leading untimestamped lines of a stream first', function() {
      var merged = Dashboard.mergeLogLines(
        ['banner without date', '2026-08-28T10:00:05: o1'],
        ['2026-08-28T10:00:01: e1']
      );
      merged.map(function(e) { return e.type; }).should.eql(['out', 'err', 'out']);
    });

    it('should handle empty streams', function() {
      Dashboard.mergeLogLines([], []).should.eql([]);
      Dashboard.mergeLogLines([], ['e']).map(function(e) { return e.type; }).should.eql(['err']);
    });
  });

  describe('displayLines (rendering order)', function() {
    it('should show the most recent line first and new lines on top', function() {
      Dashboard.preload(proc(20, 'api'), ['old1', 'old2'], []);
      Dashboard.log('out', packet(20, 'api', 'new'));

      Dashboard.displayLines(20).map(function(l) { return l.replace(/.*> /, ''); })
        .should.eql(['new', 'old2', 'old1']);
    });

    it('should not mutate the underlying buffer', function() {
      Dashboard.preload(proc(21, 'api'), ['a', 'b'], []);
      Dashboard.displayLines(21);
      Dashboard.logLines[21].map(function(l) { return l.slice(-1); }).should.eql(['a', 'b']);
    });

    it('should return null for an unknown process', function() {
      should(Dashboard.displayLines(999)).be.null();
    });
  });

  describe('formatMetrics (custom metrics pane alignment)', function() {
    var strip = function(l) { return l.replace(/\{\|\}/g, '|').replace(/\{[^}]+\}/g, ''); };

    it('should right-align values and give units a fixed-width column', function() {
      var lines = Dashboard.formatMetrics({
        'Heap Size'        : { value: '32.48', unit: 'MiB' },
        'Heap Usage'       : { value: '84.98', unit: '%' },
        'Active handles'   : { value: 5 },
        'HTTP'             : { value: 0, unit: 'req/min' },
        'Event Loop Latency': { unit: 'ms' }
      }).map(strip);

      // every value column ends at the same offset from the end of the unit column
      var cols = lines.map(function(l) { return l.split(' | ')[1]; });
      cols.should.eql([
        '32.48 MiB    ',
        '84.98 %      ',
        '    5        ',
        '    0 req/min',
        '      ms     '
      ]);
    });

    it('should shorten long names so the value always fits in the pane width', function() {
      var lines = Dashboard.formatMetrics({
        'Event Loop Latency p95': { value: '0.95', unit: 'ms' },
        'Heap Size'             : { value: '32.48', unit: 'MiB' }
      }, 26).map(strip);

      // with a known width, lines are padded by hand to exactly that width
      lines.forEach(function(l) { l.length.should.eql(26); });
      lines[0].should.eql('Event Loop Late…  0.95 ms ');
      lines[1].should.eql('Heap Size        32.48 MiB');
    });

    it('should round non-integer numbers to two decimals and leave integers alone', function() {
      Dashboard.formatMetricValue(3713.249999999994).should.eql('3713.25');
      Dashboard.formatMetricValue(0.5).should.eql('0.50');
      Dashboard.formatMetricValue('84.98123').should.eql('84.98');
      Dashboard.formatMetricValue(0).should.eql('0');
      Dashboard.formatMetricValue('5').should.eql('5');
      Dashboard.formatMetricValue('N/A').should.eql('N/A');
      Dashboard.formatMetricValue('').should.eql('');
      Dashboard.formatMetricValue(true).should.eql('true');
      Dashboard.formatMetricValue(Infinity).should.eql('Infinity');
    });

    it('should accept legacy scalar metrics and omit the unit column when none has a unit', function() {
      Dashboard.formatMetrics({ a: 12, bb: 3 }).map(strip)
        .should.eql(['a | 12', 'bb |  3']);
    });

    it('should handle an empty or missing axm_monitor', function() {
      Dashboard.formatMetrics({}).should.eql([]);
      Dashboard.formatMetrics(undefined).should.eql([]);
    });
  });

  describe('replay (live events buffered during preload)', function() {
    it('should skip lines already loaded from the file, keep new ones', function() {
      Dashboard.preload(proc(9, 'api'), ['a', 'b', 'c'], []);
      Dashboard.replay('out', packet(9, 'api', 'b\nc\nd'));

      Dashboard.logLines[9].map(function(l) { return l.slice(-1); })
        .should.eql(['a', 'b', 'c', 'd']);
    });

    it('should not drop a legitimately repeated line', function() {
      Dashboard.preload(proc(10, 'api'), ['tick', 'tick'], []);
      Dashboard.replay('out', packet(10, 'api', 'tick\ntick\ntick'));

      // 2 from history + 1 new (2 matched the history tail)
      Dashboard.logLines[10].length.should.eql(3);
    });

    it('should not match across streams (out vs err colors differ)', function() {
      Dashboard.preload(proc(11, 'api'), ['same'], []);
      Dashboard.replay('err', packet(11, 'api', 'same'));
      Dashboard.logLines[11].length.should.eql(2);
    });
  });

  describe('preload', function() {
    it('should fill the process buffer with merged history, bounded to maxLines', function() {
      Dashboard.maxLines = 3;
      Dashboard.preload(proc(7, 'api'), ['o1', 'o2', 'o3'], ['e1', 'e2']);

      Dashboard.logLines[7].length.should.eql(3);
      Dashboard.logLines[7][0].should.match(/o3$/);
      Dashboard.logLines[7][2].should.match(/e2$/);
    });

    it('should let live lines follow the history in order', function() {
      Dashboard.preload(proc(8, 'api'), ['old'], []);
      Dashboard.log('out', packet(8, 'api', 'new'));

      Dashboard.logLines[8].length.should.eql(2);
      Dashboard.logLines[8][0].should.match(/old$/);
      Dashboard.logLines[8][1].should.match(/new$/);
    });
  });

  describe('Log.getLastLines', function() {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-lastlines-'));
    var file = path.join(dir, 'app-out.log');

    before(function() {
      var content = '';
      for (var i = 1; i <= 50; i++) content += 'line ' + i + '\n';
      fs.writeFileSync(file, content);
    });

    after(function() {
      try { fs.unlinkSync(file); fs.rmdirSync(dir); } catch (e) {}
    });

    it('should return the last N lines', function(done) {
      Log.getLastLines(file, 10, function(lines) {
        lines.length.should.eql(10);
        lines[0].should.eql('line 41');
        lines[9].should.eql('line 50');
        done();
      });
    });

    it('should return the whole file when it has fewer than N lines', function(done) {
      Log.getLastLines(file, 500, function(lines) {
        lines.length.should.eql(50);
        lines[0].should.eql('line 1');
        done();
      });
    });

    it('should not return a partial first line when reading a large file', function(done) {
      var big = path.join(dir, 'big.log');
      var content = '';
      for (var i = 1; i <= 2000; i++) content += 'this is a fairly long log line number ' + i + '\n';
      fs.writeFileSync(big, content);

      Log.getLastLines(big, 5, function(lines) {
        lines.length.should.eql(5);
        lines[0].should.eql('this is a fairly long log line number 1996');
        lines[4].should.eql('this is a fairly long log line number 2000');
        fs.unlinkSync(big);
        done();
      });
    });

    it('should return N lines even when lines are much longer than the 200-byte hint', function(done) {
      var long = path.join(dir, 'long.log');
      var content = '';
      for (var i = 1; i <= 50; i++) content += 'L' + i + ' ' + 'x'.repeat(1000) + '\n';
      fs.writeFileSync(long, content);

      Log.getLastLines(long, 10, function(lines) {
        lines.length.should.eql(10);
        lines[0].should.startWith('L41 ');
        lines[9].should.startWith('L50 ');
        fs.unlinkSync(long);
        done();
      });
    });

    it('should not corrupt multi-byte UTF-8 characters', function(done) {
      var utf = path.join(dir, 'utf.log');
      var content = '';
      for (var i = 0; i < 40000; i++) content += 'é\n';
      fs.writeFileSync(utf, content);

      Log.getLastLines(utf, 30000, function(lines) {
        lines.length.should.eql(30000);
        lines.every(function(l) { return l === 'é'; }).should.eql(true);
        fs.unlinkSync(utf);
        done();
      });
    });

    it('should keep the last line of a file without trailing newline and strip CR', function(done) {
      var crlf = path.join(dir, 'crlf.log');
      fs.writeFileSync(crlf, 'a\r\nb\r\nc');

      Log.getLastLines(crlf, 2, function(lines) {
        lines.should.eql(['b', 'c']);
        fs.unlinkSync(crlf);
        done();
      });
    });

    it('should return [] for a missing file, an empty file, or lines <= 0', function(done) {
      var empty = path.join(dir, 'empty.log');
      fs.writeFileSync(empty, '');

      Log.getLastLines(path.join(dir, 'nope.log'), 10, function(l1) {
        l1.should.eql([]);
        Log.getLastLines(empty, 10, function(l2) {
          l2.should.eql([]);
          Log.getLastLines(file, 0, function(l3) {
            l3.should.eql([]);
            Log.getLastLines(undefined, 10, function(l4) {
              l4.should.eql([]);
              fs.unlinkSync(empty);
              done();
            });
          });
        });
      });
    });
  });
});
