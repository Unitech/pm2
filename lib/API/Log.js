/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var fs     = require('fs'),
    util   = require('util'),
    chalk  = require('ansis'),
    forEachLimit  = require('async/forEachLimit'),
    dayjs = require('dayjs');

var Log = module.exports = {};

var DEFAULT_PADDING = '          ';

/**
 * Tail logs from file stream.
 * @param {Object} apps_list
 * @param {Number} lines
 * @param {Boolean} raw
 * @param {Function} callback
 * @return
 */

/**
 * Read the last N lines of a file. Never throws: a missing, unreadable
 * or empty file yields an empty array.
 * @param {String} filename
 * @param {Number} lines
 * @param {Function} callback (lines: Array<String>)
 */
// Read window: starts at ~200 bytes/line, doubles while the window does
// not hold enough lines, never exceeds MAX_READ_WINDOW bytes
var LINE_SIZE_HINT  = 200;
var MAX_READ_WINDOW = 10 * 1024 * 1024;

Log.getLastLines = function(filename, lines, callback) {
  lines = parseInt(lines, 10);
  if (!filename || !(lines > 0))
    return callback([]);

  fs.stat(filename, function(err, stat) {
    if (err || !stat.isFile() || stat.size === 0)
      return callback([]);

    fs.open(filename, 'r', function(err, fd) {
      if (err)
        return callback([]);

      var finish = function(result) {
        fs.close(fd, function() {});
        callback(result);
      };

      var attempt = function(window) {
        window = Math.min(window, MAX_READ_WINDOW, stat.size);
        var start = stat.size - window;
        // read one extra byte before the window to know whether the
        // window begins on a line boundary
        var from = start > 0 ? start - 1 : 0;
        var len = stat.size - from;
        var buf = Buffer.alloc(len);

        fs.read(fd, buf, 0, len, from, function(err, bytes) {
          if (err)
            return finish([]);

          var text = buf.toString('utf8', 0, bytes);
          var parts = text.split('\n');

          if (parts.length && parts[parts.length - 1] === '')
            parts.pop();
          // the first segment is either the extra byte '\n' (empty part)
          // or a partial line: drop it in both cases
          if (start > 0 && parts.length)
            parts.shift();

          if (parts.length < lines && start > 0 && window < MAX_READ_WINDOW)
            return attempt(window * 2);

          finish(parts.slice(-lines).map(function(line) {
            return line.replace(/\r$/, '');
          }));
        });
      };

      attempt(lines * LINE_SIZE_HINT);
    });
  });
};

Log.tail = function(apps_list, lines, raw, callback) {
  var that = this;

  if (lines === 0 || apps_list.length === 0)
    return callback && callback();

  var count = 0;

  var getLastLines = Log.getLastLines;

  apps_list.sort(function(a, b) {
    return (fs.existsSync(a.path) ? fs.statSync(a.path).mtime.valueOf() : 0) -
      (fs.existsSync(b.path) ? fs.statSync(b.path).mtime.valueOf() : 0);
  });

  forEachLimit(apps_list, 1, function(app, next) {
    if (!fs.existsSync(app.path || ''))
      return next();

    getLastLines(app.path, lines, function(output) {
      console.log(chalk.gray('%s last %d lines:'), app.path, lines);
      output.forEach(function(out) {
        if (raw)
          return app.type === 'err' ? console.error(out) : console.log(out);
        if (app.type === 'out')
          process.stdout.write(chalk.green(pad(DEFAULT_PADDING, app.app_name)  + ' | '));
        else if (app.type === 'err')
          process.stdout.write(chalk.red(pad(DEFAULT_PADDING, app.app_name)  + ' | '));
        else
          process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | '));
        console.log(out);
      });
      if (output.length)
        process.stdout.write('\n');
      next();
    });
  }, function() {
    callback && callback();
  });
};

/**
 * Stream logs in realtime from the bus eventemitter.
 * @param {String} id
 * @param {Boolean} raw
 * @return
 */

/**
 * Turn a "/pattern/" CLI argument into a RegExp, null otherwise
 * @param {String} id
 * @return {RegExp|null}
 */
Log.parseRegexId = function(id) {
  if (typeof id !== 'string' || id.length < 3 || id[0] !== '/' || id[id.length - 1] !== '/')
    return null;
  try {
    return new RegExp(id.slice(1, -1));
  } catch (e) {
    return null;
  }
};

Log.stream = function(Client, id, raw, timestamp, exclusive, highlight) {
  var that = this;
  var regex = Log.parseRegexId(id);

  Client.launchBus(function(err, bus, socket) {

    socket.on('reconnect attempt', function() {
      if (global._auto_exit === true) {
        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.gray(dayjs().format(timestamp) + ' ')));
        process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | ') + '[[[ Target PM2 killed. ]]]');
        process.exit(0);
      }
    });

    var min_padding = 3

    bus.on('log:*', function(type, packet) {
        var isMatchingProcess = id === 'all'
            || packet.process.name == id
            || packet.process.pm_id == id
            || packet.process.namespace == id
            || (regex !== null && regex.test(packet.process.name));

      if (!isMatchingProcess)
        return;

      if ((type === 'out' && exclusive === 'err')
         || (type === 'err' && exclusive === 'out')
         || (type === 'PM2' && exclusive !== false))
        return;

      var lines;

      if (typeof(packet.data) === 'string')
        lines = (packet.data || '').split('\n');
      else
        return;

      lines.forEach(function(line) {
        if (!line || line.length === 0) return;

        if (raw)
          return type === 'err' ? process.stderr.write(util.format(line) + '\n') : process.stdout.write(util.format(line) + '\n');

        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.gray(dayjs().format(timestamp) + ' ')));

        var name = packet.process.pm_id + '|' + packet.process.name;

        if (name.length > min_padding)
          min_padding = name.length + 1

        if (type === 'out')
          process.stdout.write(chalk.green(pad(' '.repeat(min_padding), name)  + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(' '.repeat(min_padding), name)  + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(' '.repeat(min_padding), 'PM2') + ' | '));
        if (highlight)
          process.stdout.write(util.format(line).replace(highlight, chalk.bgBlackBright(highlight)) + '\n');
        else
          process.stdout.write(util.format(line)+ '\n');
      });
    });
  });
};

Log.devStream = function(Client, id, raw, timestamp, exclusive) {
  var that = this;

  Client.launchBus(function(err, bus) {

    setTimeout(function() {
      bus.on('process:event', function(packet) {
        if (packet.event == 'online')
          console.log(chalk.green('[rundev] App %s restarted'), packet.process.name);
      });
    }, 1000);

    var min_padding = 3

    bus.on('log:*', function(type, packet) {
      if (id !== 'all'
          && packet.process.name != id
          && packet.process.pm_id != id)
        return;

      if ((type === 'out' && exclusive === 'err')
          || (type === 'err' && exclusive === 'out')
          || (type === 'PM2' && exclusive !== false))
        return;

      if (type === 'PM2')
        return;

      var name = packet.process.pm_id + '|' + packet.process.name;

      var lines;

      if (typeof(packet.data) === 'string')
        lines = (packet.data || '').split('\n');
      else
        return;

      lines.forEach(function(line) {
        if (!line || line.length === 0) return;

        if (raw)
          return process.stdout.write(util.format(line) + '\n');

        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.gray(dayjs().format(timestamp) + ' ')));

        var name = packet.process.name + '-' + packet.process.pm_id;

        if (name.length > min_padding)
          min_padding = name.length + 1

        if (type === 'out')
          process.stdout.write(chalk.green(pad(' '.repeat(min_padding), name)  + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(' '.repeat(min_padding), name)  + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(' '.repeat(min_padding), 'PM2') + ' | '));
        process.stdout.write(util.format(line) + '\n');
      });
    });
  });
};

Log.jsonStream = function(Client, id) {
  var that = this;

  Client.launchBus(function(err, bus) {
    if (err) console.error(err);

    bus.on('process:event', function(packet) {
      process.stdout.write(JSON.stringify({
        timestamp : dayjs(packet.at),
        type      : 'process_event',
        status    : packet.event,
        app_name  : packet.process.name
      }));
      process.stdout.write('\n');
    });

    bus.on('log:*', function(type, packet) {
      if (id !== 'all'
          && packet.process.name != id
          && packet.process.pm_id != id)
        return;

      if (type === 'PM2')
        return;

      if (typeof(packet.data) == 'string')
        packet.data = packet.data.replace(/(\r\n|\n|\r)/gm,'');

      process.stdout.write(JSON.stringify({
        message : packet.data,
        timestamp : dayjs(packet.at),
        type : type,
        process_id : packet.process.pm_id,
        app_name : packet.process.name
      }));
      process.stdout.write('\n');
    });
  });
};

Log.formatStream = function(Client, id, raw, timestamp, exclusive, highlight) {
  var that = this;

  Client.launchBus(function(err, bus) {

    bus.on('log:*', function(type, packet) {
      if (id !== 'all'
          && packet.process.name != id
          && packet.process.pm_id != id)
        return;

      if ((type === 'out' && exclusive === 'err')
          || (type === 'err' && exclusive === 'out')
          || (type === 'PM2' && exclusive !== false))
        return;

      if (type === 'PM2' && raw)
        return;

      var name = packet.process.name + '-' + packet.process.pm_id;

      var lines;

      if (typeof(packet.data) === 'string')
        lines = (packet.data || '').split('\n');
      else
        return;

      lines.forEach(function(line) {
        if (!line || line.length === 0) return;

        if (!raw) {
          if (timestamp)
            process.stdout.write('timestamp=' + dayjs().format(timestamp) + ' ');
          if (packet.process.name === 'PM2')
            process.stdout.write('app=pm2 ');
          if (packet.process.name !== 'PM2')
            process.stdout.write('app=' + packet.process.name + ' id=' + packet.process.pm_id + ' ');
          if (type === 'out')
            process.stdout.write('type=out ');
          else if (type === 'err')
            process.stdout.write('type=error ');
        }

        process.stdout.write('message=');
        if (highlight)
          process.stdout.write(util.format(line).replace(highlight, chalk.bgBlackBright(highlight)) + '\n');
        else
          process.stdout.write(util.format(line) + '\n');
      });
    });
  });
};

function pad(pad, str, padLeft) {
  if (typeof str === 'undefined')
    return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}
