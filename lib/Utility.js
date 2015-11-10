
var clone     = require('safe-clone-deep');
var fs        = require('fs');
var path      = require('path');
var cst       = require('../constants.js');
var async     = require('async');
var util      = require('util');

var Utility = module.exports = {
  getDate : function() {
    return Date.now();
  },
  formatCLU : function(process) {
    if (!process.pm2_env) {
      return process;
    }

    var obj = Utility.clone(process.pm2_env);
    delete obj.env;

    return obj;
  },
  whichFileExists : function(file_arr) {
    var f = null;

    file_arr.some(function(file) {
      try {
        fs.statSync(file);
      } catch(e) {
        return false;
      }
      f = file;
      return true;
    });
    return f;
  },
  clone     : function(obj) {
    if (obj === null || obj === undefined) return {};
    return clone(obj);
  },
  overrideConsole : function(bus) {
    if (cst.PM2_LOG_DATE_FORMAT && typeof cst.PM2_LOG_DATE_FORMAT == 'string'){
      var moment = require('moment');

      // Generate timestamp prefix
      function timestamp(){
        return moment().format(cst.PM2_LOG_DATE_FORMAT) + ': ';
      }

      var hacks = ['info', 'log', 'error', 'warn'], consoled = {};

      // store console functions.
      hacks.forEach(function(method){
        consoled[method] = console[method];
      });

      // Hack Console.
      hacks.forEach(function(k){
        console[k] = function(){
          if (bus) {
            bus.emit('log:PM2', {
              process : {
                pm_id      : 'PM2',
                name       : 'PM2',
                rev        : null
              },
              at  : Utility.getDate(),
              data : util.format.apply(this, arguments) + '\n'
            });
          }
          // do not destroy variable insertion
          arguments[0] && (arguments[0] = timestamp() + arguments[0]);
          consoled[k].apply(console, arguments);
        };
      });
    }
  },
  startLogging : function(stds, callback) {
    /**
     * Start log outgoing messages
     * @method startLogging
     * @param {} callback
     * @return
     */
    // Make sure directories of `logs` and `pids` exist.
    try {
      ['logs', 'pids'].forEach(function(n){
        (function(_path){
          !fs.existsSync(_path) && fs.mkdirSync(_path, '0755');
        })(path.resolve(cst.PM2_ROOT_PATH, n));
      });
    } catch(err) {
      return callback(new Error('can not create directories (logs/pids):' + err.message));
    }

    // waterfall.
    var flows = [];
    // types of stdio, should be sorted as `std(entire log)`, `out`, `err`.
    var types = Object.keys(stds).sort(function(x, y){
      return -x.charCodeAt(0) + y.charCodeAt(0);
    });

    // Create write streams.
    (function createWS(io){
      if(io.length != 1){
        return false;
      }
      io = io[0];

      // If `std` is a Stream type, try next `std`.
      // compatible with `pm2 reloadLogs`
      if(typeof stds[io] == 'object' && !isNaN(stds[io].fd)){
        return createWS(types.splice(0, 1));
      }

      flows.push(function(next){
        var file = stds[io];

        stds[io] = fs.createWriteStream(file, {flags: 'a'})
          .on('error', function(err){
            next(err);
          })
          .on('open', function(){
            next();
          });
        stds[io]._file = file;
      });
      return createWS(types.splice(0, 1));
    })(types.splice(0, 1));

    async.waterfall(flows, callback);
  }
};
