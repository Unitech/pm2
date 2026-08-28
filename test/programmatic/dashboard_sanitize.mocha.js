/**
 * Issue #5397 — characters from old log lines stayed "stuck" on the
 * `pm2 monit` log pane. Two causes, two fixes:
 *  - blessed (vendored in modules/blessed) counted emoji as one cell while
 *    terminals draw them on two: every following cell was shifted on the
 *    real terminal and never redrawn
 *  - raw log lines reached blessed with \r, cursor escape sequences and
 *    {tags}, which it either misread or drew as-is
 */

process.env.NODE_ENV = 'test';

var should    = require('should');
var Dashboard = require('../../lib/API/Dashboard');
var unicode   = require('../../modules/blessed/lib/unicode');

describe('Dashboard log line sanitizing (#5397)', function() {

  beforeEach(function() {
    Dashboard.logLines = {};
    Dashboard.maxLines = Dashboard.parseLines(undefined);
  });

  describe('sanitizeLine', function() {
    it('should keep a plain line untouched', function() {
      Dashboard.sanitizeLine('hello world 42').should.eql('hello world 42');
      Dashboard.sanitizeLine('中文 🚀 ok').should.eql('中文 🚀 ok');
    });

    it('should keep the last segment of a \\r rewritten line', function() {
      Dashboard.sanitizeLine('progress 10%\rprogress 50%\rdone').should.eql('done');
      Dashboard.sanitizeLine('spinner |\rspinner /\r').should.eql('spinner /');
      Dashboard.sanitizeLine('\r\r').should.eql('');
    });

    it('should drop non-SGR escape sequences and keep colors', function() {
      Dashboard.sanitizeLine('cursor\x1b[2K\x1b[1A\x1b[3Dmove').should.eql('cursormove');
      Dashboard.sanitizeLine('\x1b[31mred\x1b[0m ok').should.eql('\x1b[31mred\x1b[0m ok');
      Dashboard.sanitizeLine('\x1b[1;32mbold green\x1b[39m').should.eql('\x1b[1;32mbold green\x1b[39m');
      Dashboard.sanitizeLine('\x1b[?25lhidden\x1b[?25h').should.eql('hidden');
      Dashboard.sanitizeLine('\x1b]0;title\x07after').should.eql('after');
      Dashboard.sanitizeLine('\x1b]8;;http://x\x1b\\link\x1b]8;;\x1b\\').should.eql('link');
      Dashboard.sanitizeLine('\x1b(Bplain\x1b7').should.eql('plain');
    });

    it('should drop control characters and expand tabs', function() {
      Dashboard.sanitizeLine('a\tb').should.eql('a    b');
      Dashboard.sanitizeLine('bell\x07 nul\x00 del\x7f').should.eql('bell nul del');
    });

    it('should escape blessed tags', function() {
      Dashboard.sanitizeLine('{bold} braces {/}').should.eql('{open}bold{close} braces {open}/{close}');
      Dashboard.sanitizeLine('{"json":true}').should.eql('{open}"json":true{close}');
    });
  });

  describe('pushLine / replay', function() {
    it('should store sanitized lines and skip empty results', function() {
      Dashboard.pushLine(0, 'app', 'out', '{"a":1}');
      Dashboard.pushLine(0, 'app', 'out', '\r');
      Dashboard.pushLine(0, 'app', 'out', '\x1b[2K');
      Dashboard.pushLine(0, 'app', 'err', '10%\r100%');
      Dashboard.logLines[0].should.eql([
        '{green-fg}app{/} > {open}"a":1{close}',
        '{red-fg}app{/} > 100%'
      ]);
    });

    it('should dedupe replayed lines against their sanitized form', function() {
      Dashboard.pushLine(0, 'app', 'out', '{"a":1}');
      Dashboard.replay('out', { process: { pm_id: 0, name: 'app' }, data: '{"a":1}\n{"b":2}' });
      Dashboard.logLines[0].should.eql([
        '{green-fg}app{/} > {open}"a":1{close}',
        '{green-fg}app{/} > {open}"b":2{close}'
      ]);
    });
  });

  describe('blessed unicode widths', function() {
    it('should count emoji as two cells', function() {
      unicode.strWidth('🚀').should.eql(2);
      unicode.strWidth('🔥✅').should.eql(4);
      unicode.strWidth('⚡⭐❌').should.eql(6);
      unicode.strWidth('😀 hi').should.eql(5);
      unicode.strWidth('🇫🇷').should.eql(2);
    });

    it('should keep CJK, ASCII, combining and symbols unchanged', function() {
      unicode.strWidth('中文').should.eql(4);
      unicode.strWidth('abc').should.eql(3);
      unicode.strWidth('é').should.eql(1);
      unicode.strWidth('✓ © ★').should.eql(5);
    });

    it('should pad emoji so the next character is not eaten', function() {
      '🚀x✅y中z'.replace(unicode.chars.all, '$1\x03').should.eql('🚀\x03x✅\x03y中\x03z');
      'abc'.replace(unicode.chars.all, '$1\x03').should.eql('abc');
    });
  });
});
