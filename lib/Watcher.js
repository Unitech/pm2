var chokidar = require('chokidar');
var p        = require('path');
var util     = require('util');
var log      = require('debug')('pm2:watch');

module.exports = function ClusterMode(God) {
  /**
   * Watch folder for changes and restart
   * @method watch
   * @param {Object} pm2_env pm2 app environnement
   * @return MemberExpression
   */
  God.watch = {};

  God.watch._watchers = [];

  God.watch.enable = function(pm2_env) {

    if (God.watch._watchers[pm2_env.name]) {
      God.watch._watchers[pm2_env.name].close();
      God.watch._watchers[pm2_env.name] = null;
      delete God.watch._watchers[pm2_env.name];
    }

    //setup the combined RegEx
    var ignored = '';

    if (pm2_env.ignore_watch) {
      var combined = pm2_env.ignore_watch.reduce(function(previous, current) {
        return previous + '|' + current;
      });

      ignored = new RegExp(combined);
    } else {
      ignored = /[\/\\]\.|node_modules/;
    }

    var watch = null;

    // check if pm2_env.watch is an array or a string

    if (pm2_env.watch &&
        (util.isArray(pm2_env.watch) || typeof pm2_env.watch == 'string' || pm2_env.watch instanceof String)) {
      watch = [].concat(pm2_env.watch).map(function(dir) {
          return p.resolve(process.env.PWD, dir);
      });
    } else {
      watch = p.dirname(pm2_env.pm_exec_path);
    }

    log('Watching folder %s', watch);

    var watch_options = {
      ignored       : ignored,
      persistent    : true,
      ignoreInitial : true
    };

    if (pm2_env.watch_options) {
      watch_options = util._extend(watch_options, pm2_env.watch_options);
    }

    log('Watch opts', watch_options);

    var watcher = chokidar.watch(watch, watch_options);

    watcher.on('all', function(event, path) {
      var self = this;

      if (self.restarting === true) {
        log('Already restarting, skipping');
        return false;
      }

      self.restarting = true;

      console.error('Change detected for app name: %s - restarting', pm2_env.name);

      God.restartProcessName(pm2_env.name, function(err, list) {
        self.restarting = false;

        if (err) {
          log('Error while restarting', err);
          return false;
        }

        return log('Process restarted');
      });

      return false;
    });

    watcher.on('error', function(e) {
      console.error(e.stack || e);
    });

    God.watch._watchers[pm2_env.name] = watcher;

    return God.watch._watchers[pm2_env.name];
  },
  /**
   * Description
   * @method close
   * @param {} id
   * @return
   */
  God.watch.disableAll = function() {
    var watchers = God.watch._watchers;

    console.log('[Watch] PM2 is being killed. Watch is disabled to avoid conflicts');
    for (var i = 0; i < watchers.length; ++i) {
      watchers[i].close && watchers[i].close();
      watchers.splice(i, 1);
    }
  },

  God.watch.disable = function(pm2_env) {
    if (God.watch._watchers[pm2_env.name]) {
      console.log('[Watch] Stop watching', pm2_env.pm_id);
      God.watch._watchers[pm2_env.name].close();
      delete God.watch._watchers[pm2_env.name];
      return true;
    } else {
      return false;
    }
  }
};
