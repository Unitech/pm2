var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var Log = require('../../lib/API/Log');

var format = 'YYYY-MM-DD HH:mm:ss';
function line(second, message) {
  return '2026-10-30 12:00:0' + second + ': ' + message;
}

describe('Chronological historical logs', function() {
  var dir, output, originalLog, originalError, originalWrite;

  beforeEach(function() {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm2-chrono-'));
    output = [];
    originalLog = console.log;
    originalError = console.error;
    originalWrite = process.stdout.write;
    console.log = function(value) { output.push(['out', value]); };
    console.error = function(value) { output.push(['err', value]); };
    process.stdout.write = function() { return true; };
  });

  afterEach(function() {
    console.log = originalLog;
    console.error = originalError;
    process.stdout.write = originalWrite;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function app(name, content, type, dateFormat) {
    var filename = path.join(dir, name);
    fs.writeFileSync(filename, content);
    return { path: filename, app_name: name, type: type || 'out',
      log_date_format: dateFormat === undefined ? format : dateFormat };
  }

  [true, false].forEach(function(newline) {
    it('keeps an entire long entry, final newline=' + newline, function(done) {
      var entry = line(1, 'é😀'.repeat(40000));
      Log.tailChronological([app('long', entry + (newline ? '\n' : ''))], 1, true, function(err) {
        assert.ifError(err);
        assert.deepStrictEqual(output, [['out', entry]]);
        done();
      });
    });

    it('returns exactly N complete lines, final newline=' + newline, function(done) {
      var entries = [line(0, 'old'), line(1, 'x'.repeat(70000)), line(2, 'last')];
      Log.tailChronological([app('tail', entries.join('\n') + (newline ? '\n' : ''))], 2, true, function(err) {
        assert.ifError(err);
        assert.deepStrictEqual(output.map(function(e) { return e[1]; }), entries.slice(-2));
        done();
      });
    });
  });

  it('handles CRLF and a newline exactly at a read chunk boundary', function(done) {
    var last = line(2, 'z'.repeat(65536 - line(2, '').length - 2));
    Log.tailChronological([app('boundary', line(0, 'old') + '\r\n' + line(1, 'first') + '\r\n' + last + '\r\n')], 2, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output, [['out', line(1, 'first')], ['out', last]]);
      done();
    });
  });

  it('merges text and JSON timestamps across processes, preserving ties and stderr', function(done) {
    var json = JSON.stringify({ timestamp: '2026-10-30T12:00:02', message: 'json' });
    var apps = [app('a', line(3, 'third') + '\n' + line(1, 'first') + '\n'),
      app('b', json + '\n' + line(3, 'tie') + '\n', 'err')];
    Log.tailChronological(apps, 2, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output, [['out', line(1, 'first')], ['err', json],
        ['out', line(3, 'third')], ['err', line(3, 'tie')]]);
      done();
    });
  });

  it('orders timestamps with explicit timezone offsets', function(done) {
    var early = '2026-10-30 12:00:00 +02:00: early';
    var late = '2026-10-30 11:00:00 +00:00: late';
    Log.tailChronological([app('zones', late + '\n' + early, 'out', 'YYYY-MM-DD HH:mm:ss Z')], 2, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output, [['out', early], ['out', late]]);
      done();
    });
  });

  it('parses custom date formats rather than guessing ISO dates', function(done) {
    var entries = ['30/10/2026 12:00:02: later', '30/10/2026 12:00:01: earlier'];
    Log.tailChronological([app('custom', entries.join('\n'), 'out', 'DD/MM/YYYY HH:mm:ss')], 2, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output.map(function(e) { return e[1]; }), entries.reverse());
      done();
    });
  });

  ['no timestamp', '2026-02-30 12:00:00: invalid', '{"timestamp":"invalid"}'].forEach(function(entry) {
    it('rejects unparseable application timestamps: ' + entry, function(done) {
      Log.tailChronological([app('invalid', line(1, 'valid') + '\n' + entry)], 2, true, function(err) {
        assert.match(err.message, /requires timestamped historical logs/);
        assert.deepStrictEqual(output, []);
        done();
      });
    });
  });

  it('skips daemon diagnostics, empty files and missing files', function(done) {
    var missing = { path: path.join(dir, 'missing'), app_name: 'missing' };
    Log.tailChronological([app('daemon', 'diagnostic\n' + line(1, 'daemon') + '\n', 'PM2'),
      app('empty', ''), missing], 2, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output, [['out', line(1, 'daemon')]]);
      done();
    });
  });

  it('does not read history when zero lines are requested', function(done) {
    Log.tailChronological([app('invalid', 'invalid')], 0, true, function(err) {
      assert.ifError(err);
      assert.deepStrictEqual(output, []);
      done();
    });
  });

  it('keeps ordinary tailing permissive and grouped by file', function(done) {
    var first = app('first', 'plain first\n');
    var second = app('second', 'plain second\n');
    fs.utimesSync(first.path, new Date(1000), new Date(1000));
    fs.utimesSync(second.path, new Date(2000), new Date(2000));
    Log.tail([second, first], 1, true, function() {
      assert.deepStrictEqual(output.filter(function(e) { return /^plain /.test(e[1]); }),
        [['out', 'plain first'], ['out', 'plain second']]);
      done();
    });
  });
});

describe('Chronological mode selection', function() {
  it('uses the existing tail and stream when chronological mode is disabled', function() {
    function CLI() {}
    require('../../lib/API/LogManagement')(CLI);
    var originalTail = Log.tail;
    var originalChronological = Log.tailChronological;
    var originalStream = Log.stream;
    var calls = [];
    var cli = new CLI();
    cli.Client = { executeRemote: function(method, args, callback) {
      callback(null, [{ pm2_env: { pm_id: 0, name: 'app', pm_out_log_path: '/tmp/app.log' } }]);
    } };
    try {
      Log.tail = function(files, lines, raw, callback) {
        calls.push('tail');
        assert.strictEqual(files[0].path, '/tmp/app.log');
        callback();
      };
      Log.tailChronological = function() { throw new Error('unexpected chronological tail'); };
      Log.stream = function() { calls.push('stream'); };
      cli.streamLogs('app', 3, true, false, false, false, false);
      assert.deepStrictEqual(calls, ['tail', 'stream']);
    } finally {
      Log.tail = originalTail;
      Log.tailChronological = originalChronological;
      Log.stream = originalStream;
    }
  });
});
