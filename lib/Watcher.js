var chokidar = require('chokidar');
var p        = require('path');
var util     = require('util');

module.exports = {
  watchers: [],
  /**
   * Watch folder for changes and restart
   * @method watch
   * @param {Object} pm2_env pm2 app environnement
   * @return MemberExpression
   */
  watch: function(pm2_env) {
    if(this.watchers[pm2_env.pm_id]) {
      delete this.watchers[pm2_env.pm_id];
    }

    //setup the combined RegEx
    var ignored;
    if(pm2_env.ignoreWatch){
      var combined = pm2_env.ignoreWatch.reduce(function(previous, current) {
          return previous + '|' + current;
      });

      ignored = new RegExp(combined);
    } else {
      ignored = /[\/\\]\.|node_modules/
    }

    var watch;

    // check if pm2_env.watch is an array or a string

    if(pm2_env.watch &&
      (util.isArray(pm2_env.watch) || typeof pm2_env.watch == 'string' || pm2_env.watch instanceof String)) {

      watch = pm2_env.watch;

    } else {
      watch = p.dirname(pm2_env.pm_exec_path);
    }

    this.watchers[pm2_env.pm_id] =

      chokidar.watch(

        watch,

        {
          ignored: ignored,
          persistent: false,
          ignoreInitial: true,

        }
      )
      .on('all', function(event, path) {
        console.log('File changed. Reloading.');
        require('./God').restartProcessId(pm2_env.pm_id, function(err, list) {
          console.log('Process restarted');
        });

      });



    return this.watchers[pm2_env.pm_id];

  },
  /**
   * Description
   * @method close
   * @param {} id
   * @return 
   */
  close: function(id) {
    if(this.watchers[id])
      return this.watchers[id].close();
    else {
      return false;
    }
  }
};
