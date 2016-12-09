/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var fs     = require('fs'),
    util   = require('util'),
    chalk  = require('chalk'),
    async  = require('async'),
    moment = require('moment');

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

Log.tail = function(apps_list, lines, raw, callback) {
  var that = this;

  if (lines === 0 || apps_list.length === 0)
    return callback && callback();

  var count = 0;

  var getLastLines = function (filename, lines, callback) {
    var chunk = '';
    var size = Math.max(0, fs.statSync(filename).size - (lines * 200));

    var fd = fs.createReadStream(filename, {start : size});
    fd.on('data', function(data) { chunk += data.toString(); });
    fd.on('end', function() {
      chunk = chunk.split('\n').slice(-(lines+1));
      chunk.pop();
      callback(chunk);
    });
  };

  apps_list.sort(function(a, b) {
    return (fs.existsSync(a.path) ? fs.statSync(a.path).mtime.valueOf() : 0) -
      (fs.existsSync(b.path) ? fs.statSync(b.path).mtime.valueOf() : 0);
  });

  async.forEachLimit(apps_list, 1, function(app, next) {
    if (!fs.existsSync(app.path || ''))
      return next();

    getLastLines(app.path, lines, function(output) {
      console.log(chalk.grey('%s last %d lines:'), app.path, lines);
      output.forEach(function(out) {
        if (raw)
          return console.log(out);
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

Log.stream = function(Client, id, raw, timestamp, exclusive) {
  var that = this;

  if (!raw)
    console.log(chalk.bold.grey(util.format.call(this, '[STREAMING] Now streaming realtime logs for [%s] process%s', id, id === 'all' ? 'es' : '')));

  Client.launchBus(function(err, bus, socket) {

    socket.on('reconnect attempt', function() {
      if (global._auto_exit === true) {
        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.grey(moment().format(timestamp) + ' ')));
        process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | ') + '[[[ Target PM2 killed. ]]]');
        process.exit(0);
      }
    });

    bus.on('log:*', function(type, packet) {
      if (id !== 'all'
          && packet.process.name != id
          && packet.process.pm_id != id)
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
        if (!line) return;

        if (raw)
          return process.stdout.write(util.format(line) + '\n');

        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.grey(moment().format(timestamp) + ' ')));

        var name = packet.process.pm_id + '|' + packet.process.name;

        if (type === 'out')
          process.stdout.write(chalk.green(pad(DEFAULT_PADDING, name)  + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(DEFAULT_PADDING, name)  + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | '));
        process.stdout.write(util.format(line) + '\n');
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
        if (!line) return;

        if (raw)
          return process.stdout.write(util.format(line) + '\n');

        if (timestamp)
          process.stdout.write(chalk['dim'](chalk.grey(moment().format(timestamp) + ' ')));

        var name = packet.process.name + '-' + packet.process.pm_id;

        if (type === 'out')
          process.stdout.write(chalk.green(pad(DEFAULT_PADDING, name)  + ' | '));
        else if (type === 'err')
          process.stdout.write(chalk.red(pad(DEFAULT_PADDING, name)  + ' | '));
        else if (!raw && (id === 'all' || id === 'PM2'))
          process.stdout.write(chalk.blue(pad(DEFAULT_PADDING, 'PM2') + ' | '));
        process.stdout.write(util.format(line) + '\n');
      });
    });
  });
};

Log.jsonStream = function(Client, app_name) {
  var that = this;

  Client.launchBus(function(err, bus) {
    if (err) console.error(err);

    bus.on('process:event', function(packet) {
      console.log(JSON.stringify({
        timestamp : moment(packet.at).toString(),
        type      : 'process_event',
        status    : packet.event,
        app_name  : packet.process.name
      }));
    });

    bus.on('log:*', function(type, packet) {
      if (app_name != 'all' && app_name && app_name != packet.process.name) return false;

      if (typeof(packet.data) == 'string')
        packet.data = packet.data.replace(/(\r\n|\n|\r)/gm,'');

      console.log(JSON.stringify({
        message : packet.data,
        timestamp : moment(packet.at),
        type : type,
        process_id : packet.process.pm_id,
        app_name : packet.process.name
      }));
    });
  });
};

Log.formatStream = function(Client, id, raw, timestamp, exclusive) {
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
        if (!line) {
          return;
        }

        if (!raw) {
          if (timestamp)
            process.stdout.write('timestamp=' + moment().format(timestamp) + ' ');
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
        process.stdout.write(util.format(line) + '\n');
      });
    });
  });
};

function printLines(lines) {
}

function pad(pad, str, padLeft) {
  if (typeof str === 'undefined')
    return pad;
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}
