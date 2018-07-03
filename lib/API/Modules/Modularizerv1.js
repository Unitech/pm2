/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var path          = require('path');
var fs            = require('fs');
var async         = require('async');
var p             = path;
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');
var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');

var MODULE_CONF_PREFIX = 'module-db';

var Modularizer = module.exports = {};

function startModule(CLI, opts, cb) {
  /** SCRIPT
   * Open file and make the script detection smart
   */

  if (!opts.cmd) throw new Error('module package.json not defined');
  if (!opts.development_mode) opts.development_mode = false;

  try {
    var package_json = require(opts.cmd);
  } catch(e) {
    Common.printError(e);
    return cb();
  }

  /**
   * Script file detection
   * 1- *apps* field (default pm2 json configuration)
   * 2- *bin* field
   * 3- *main* field
   */
  if (!package_json.apps) {
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
    return cb(null, data);
  });
};

Modularizer.launchModules = function(CLI, cb) {
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');
  var modules = Configuration.getSync(MODULE_CONF_PREFIX);

  if (!modules) return cb();

  async.eachLimit(Object.keys(modules), 1, function(module, next) {
    var pmod = p.join(module_folder, module, cst.DEFAULT_MODULE_JSON);

    Common.printOut(cst.PREFIX_MSG_MOD + 'Starting module ' + module);

    var opts = {};

    if (modules[module] != true) {
      Common.extend(opts, modules[module]);
    }

    Common.extend(opts, {
      cmd : pmod,
      development_mode : false,
      proc_path : p.join(module_folder, module)
    });

    startModule(CLI, opts, function(err, dt) {
      if (err) console.error(err);
      return next();
    });

  }, function() {
    return cb ? cb(null) : false;
  });
}

Modularizer.installModule = function(CLI, module_name, opts, cb) {
  var proc_path = '',
      cmd  = '',
      conf = {},
      development_mode = false;

  var cli = {
    bin : 'npm',
    cmd : 'install'
  }

  Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[' + cli.bin.toUpperCase() + ']') + ' to install ' + module_name + ' ...');

  var install_instance = spawn(cst.IS_WINDOWS ? cli.bin + '.cmd' : cli.bin, [cli.cmd, module_name, '--loglevel=error'], {
    stdio : 'inherit',
    env: process.env,
		shell : true,
    cwd : cst.PM2_ROOT_PATH
  });

  install_instance.on('close', finalize);

  install_instance.on('error', function (err) {
    console.error(err.stack || err);
  });

  function finalize(code) {
    if (code != 0) {
      return cb(new Error("Installation failed"));
    }

    Common.printOut(cst.PREFIX_MSG_MOD + 'Module downloaded');

    var canonic_module_name = Utility.getCanonicModuleName(module_name);

    proc_path = p.join(cst.PM2_ROOT_PATH, 'node_modules', canonic_module_name);

    cmd = p.join(proc_path, cst.DEFAULT_MODULE_JSON);

    /**
     * Append default configuration to module configuration
     */
    try {
      var conf = JSON.parse(fs.readFileSync(path.join(proc_path, 'package.json')).toString()).config;
      if (conf) {
        Object.keys(conf).forEach(function(key) {
          Configuration.setSyncIfNotExist(canonic_module_name + ':' + key, conf[key]);
        });
      }
    } catch(e) {
      Common.printError(e);
    }

    opts = Common.extend(opts, {
      cmd : cmd,
      development_mode : development_mode,
      proc_path : proc_path
    });

    Configuration.set(MODULE_CONF_PREFIX + ':' + canonic_module_name, {
      uid : opts.uid,
      gid : opts.gid,
      version : 0
    }, function(err, data) {

      startModule(CLI, opts, function(err, dt) {
        if (err) return cb(err);

        if (process.env.PM2_PROGRAMMATIC === 'true')
          return cb(null, dt);

        CLI.conf(canonic_module_name, function() {
          Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
          Common.printOut(cst.PREFIX_MSG_MOD + 'Edit configuration via: `pm2 conf`');
          return cb(null, dt);
        });
      });
    });
  }
}
