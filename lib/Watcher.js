var chokidar = require('chokidar')
var p          = require('path');

module.exports = {
  watchers: [],
  /**
  * Watch folder for changes and restart
  * @param  {Object} pm2_env pm2 app environnement
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
      })
      
      ignored = new RegExp(combined);
    } else {
      ignored = /[\/\\]\.|node_modules/
    }

     this.watchers[pm2_env.pm_id] =

      chokidar.watch(

        p.dirname(pm2_env.pm_exec_path), 
        
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
  close: function(id) {
    return this.watchers[id].close()
  },
}