var fs    = require('fs'),
    chalk = require('chalk'),
    CLI   = require('./CLI.js');

var Log = module.exports = {};

/**
 * Tail logs from file stream.
 * @param {Object} apps_list
 * @param {Number} lines
 * @param {Boolean} raw
 * @param {Function} callback
 * @return
 */

Log.tail = function(apps_list, lines, raw, callback) {
  if (lines === 0 || apps_list.length === 0)
    return callback && callback();

  var count = 0;

  apps_list.forEach(function(app, index) {
    if (fs.existsSync(app.path || '')) {
      fs.readFile(app.path, function(err, data) {
        if (err)
          return console.error(err.stack || err);

        var output = data.toString().split('\n').slice(-(lines+1));
        output.pop();
        output.forEach(function(out) {
          if (!raw) {
            if (app.type === 'out') process.stdout.write(chalk.bold['green'](app.app_name + ' (out): '));
            else if (app.type === 'err') process.stdout.write(chalk.bold['red'](app.app_name + ' (err): '));
            else process.stdout.write(chalk.bold['blue']('PM2:') + ' ');
          }
          console.log(out);
        });
        if (output.length)
          process.stdout.write('\n');
        ++count;
        if (count === apps_list.length)
          callback && callback();
      });
    }
  });
};

/**
 * Stream logs in realtime from the bus eventemitter.
 * @param {String} id
 * @param {Boolean} raw
 * @return
 */

Log.stream = function(id, raw) {

  CLI.launchBus(function(err, bus) {

    bus.on('log:*', function(type, data) {
      if (id != 'all' && data.process.name != id && data.process.pm_id != id)
        return;

      var name = data.process.name + '-' + data.process.pm_id;

      if (!raw) {
        if (type === 'out') process.stdout.write(chalk.bold['green'](name + ' (out): '));
        else if (type === 'err') process.stdout.write(chalk.bold['red'](name + ' (err): '));
        else if (!raw && (id === 'all' || id === 'PM2')) process.stdout.write(chalk.bold['blue']('PM2:') + ' ');
      }
      if (type === 'PM2' && raw)
        return;
      process.stdout.write(data.data ? data.data : '');
    });

  });

};
