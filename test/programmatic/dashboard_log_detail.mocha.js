/**
 * Enter on a log line in `pm2 monit` opens the full, untruncated text.
 * The list shows newest first; the detail lookup has to follow that order,
 * and ANSI / blessed escapes must not hide the level word or the braces.
 */

process.env.NODE_ENV = 'test';

var should    = require('should');
var Dashboard = require('../../lib/API/Dashboard');

describe('Dashboard log line detail', function() {

  beforeEach(function() {
    Dashboard.logLines = {};
    Dashboard.rawLogLines = {};
    Dashboard.maxLines = Dashboard.parseLines(undefined);
    Dashboard.currentProcessId = null;
  });

  it('should keep plain text in display order, newest first', function() {
    Dashboard.pushLine(0, 'api', 'out', 'first');
    Dashboard.pushLine(0, 'api', 'err', 'second');

    var newest = Dashboard.logEntryAt(0, 0);
    var older = Dashboard.logEntryAt(0, 1);

    newest.text.should.eql('second');
    newest.type.should.eql('err');
    newest.processName.should.eql('api');
    should(newest.receivedAt).eql(null);
    older.text.should.eql('first');
    older.type.should.eql('out');
  });

  it('should record when a live line was received', function() {
    var when = new Date('2026-07-30T12:00:00Z');
    Dashboard.pushLine(0, 'api', 'out', 'hello', { receivedAt: when });
    Dashboard.logEntryAt(0, 0).receivedAt.should.eql(when);
  });

  it('should strip ANSI around the level and restore braces', function() {
    Dashboard.pushLine(0, 'api', 'out', '\x1b[32minfo\x1b[39m: {"ok":true}');
    var entry = Dashboard.logEntryAt(0, 0);
    entry.text.should.eql('info: {"ok":true}');
    Dashboard.formatLogDetail(entry).should.match(/INFO/);
    Dashboard.formatLogDetail(entry).should.match(/\{"ok":true\}/);
  });

  it('should detect a timestamp and say file lines were not received live', function() {
    Dashboard.pushLine(0, 'api', 'out', '2026-08-28T10:00:00: warn: disk full');
    var body = Dashboard.formatLogDetail(Dashboard.logEntryAt(0, 0));
    body.should.match(/2026-08-28T10:00:00/);
    body.should.match(/WARN/);
    body.should.match(/loaded from log file/);
  });

  it('should drop detail entries in lockstep with the display buffer', function() {
    Dashboard.maxLines = 2;
    Dashboard.pushLine(0, 'api', 'out', 'one');
    Dashboard.pushLine(0, 'api', 'out', 'two');
    Dashboard.pushLine(0, 'api', 'out', 'three');
    Dashboard.logLines[0].length.should.eql(2);
    Dashboard.rawLogLines[0].length.should.eql(2);
    Dashboard.logEntryAt(0, 0).text.should.eql('three');
    Dashboard.logEntryAt(0, 1).text.should.eql('two');
  });
});
