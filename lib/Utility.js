/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var fclone = require('fclone');
var fs     = require('fs');
var path   = require('path');
var cst    = require('../constants.js');
var async  = require('async');
var util   = require('util');

var Utility = module.exports = {
  getDate : function() {
    return Date.now();
  },
  extendExtraConfig : function(proc, opts) {
    if (opts.env && opts.env.current_conf) {
      Utility.extend(proc.pm2_env, opts.env.current_conf);
      delete opts.env.current_conf;
    }
  },
  formatCLU : function(process) {
    if (!process.pm2_env) {
      return process;
    }

    var obj = Utility.clone(process.pm2_env);
    delete obj.env;

    return obj;
  },
  extend : function(destination, source){
    if (!source || typeof source != 'object') return destination;

      Object.keys(source).forEach(function(new_key) {
        if (source[new_key] != '[object Object]')
          destination[new_key] = source[new_key];
      });

    return destination;
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
    return fclone(obj);
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
    // try {
    //   ['logs', 'pids'].forEach(function(n){
    //     console.log(n);
    //     (function(_path){
    //       !fs.existsSync(_path) && fs.mkdirSync(_path, '0755');
    //     })(path.resolve(cst.PM2_ROOT_PATH, n));
    //   });
    // } catch(err) {
    //   return callback(new Error('can not create directories (logs/pids):' + err.message));
    // }

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

        if (!file) return false;
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
  },
  /**
   * Returns the module name from a .tgz package name (or the original name if it is not a valid pkg).
   * @param {string} package_name The package name (e.g. "foo.tgz", "foo-1.0.0.tgz", "folder/foo.tgz")
   * @return {string} the name
   */
  packageNameToModuleName: function(package_name) {
    if (package_name.match(/^(.+\/)?([^\/]+)\.tgz($|\?)/)) {
      package_name = package_name.match(/^(.+\/)?([^\/]+)\.tgz($|\?)/)[2];
      if (package_name.match(/^(.+)-[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9_]+\.[0-9]+)?$/)) {
        package_name = package_name.match(/^(.+)-[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9_]+\.[0-9]+)?$/)[1];
      }
    }
    return package_name;
  }

};
