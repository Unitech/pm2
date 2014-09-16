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

    if (pm2_env.ignoreWatch) {
      var combined = pm2_env.ignoreWatch.reduce(function(previous, current) {
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
      watch = pm2_env.watch;
    } else {
      watch = p.dirname(pm2_env.pm_exec_path);
    }

    log('Watching folder %s', watch);

    var watcher = chokidar.watch(watch, {
      ignored       : ignored,
      persistent    : false,
      ignoreInitial : true
    });

    watcher.on('all', function(event, path) {
      var self = this;

      if (self.restarting === true) {
        log('Already restarting skipping');
        return false;
      }

      self.restarting = true;

      log('Change detected for app name: %s - restarting', pm2_env.name);

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
  God.watch.disable = function(pm2_env) {
    if (God.watch._watchers[pm2_env.name]) {
      God.watch._watchers[pm2_env.name].close();
      delete God.watch._watchers[pm2_env.name];
      return true;
    } else {
      return false;
    }
  }
};
