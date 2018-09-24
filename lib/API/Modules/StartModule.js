var path          = require('path');
var fs            = require('fs');
var os            = require('os');
var parallel      = require('async/parallel');
var eachLimit     = require('async/eachLimit');
var forEachLimit  = require('async/forEachLimit');
var p             = path;
var readline      = require('readline');
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');
var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');
var ModularizerV1 = require('./Modularizerv1.js');
var Rollback = require('./Rollback.js')

function startModule(CLI, opts, cb) {
  if (!opts.cmd && !opts.package) throw new Error('module package.json not defined');
  if (!opts.development_mode) opts.development_mode = false;

  var package_json = require(opts.cmd || opts.package);

  /**
   * Script file detection
   * 1- *apps* field (default pm2 json configuration)
   * 2- *bin* field
   * 3- *main* field
   */
  if (!package_json.apps && !package_json.pm2) {
    package_json.apps = {};

    if (package_json.bin) {
      var bin = Object.keys(package_json.bin)[0];
      package_json.apps.script = package_json.bin[bin];
    }
    else if (package_json.main) {
      package_json.apps.script = package_json.main;
    }
  }

  Common.extend(opts, {
    cwd               : opts.proc_path,
    watch             : opts.development_mode,
    force_name        : package_json.name,
    started_as_module : true
  });

  // Start the module
  CLI.start(package_json, opts, function(err, data) {
    if (err) return cb(err);

    if (opts.safe) {
      Common.printOut(cst.PREFIX_MSG_MOD + 'Monitoring module behavior for potential issue (5secs...)');

      var time = typeof(opts.safe) == 'boolean' ? 3000 : parseInt(opts.safe);
      return setTimeout(function() {
        CLI.describe(package_json.name, function(err, apps) {
          if (err || apps[0].pm2_env.restart_time > 2) {
            return Rollback.revert(CLI, package_json.name, function() {
              return cb(new Error('New Module is instable, restored to previous version'));
            });
          }
          return cb(null, data);
        });
      }, time);
    }

    return cb(null, data);
  });
};

module.exports = startModule
