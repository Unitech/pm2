/**
 * Copyright 2013-2021 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var path          = require('path');
var eachLimit     = require('async/eachLimit');
var forEachLimit  = require('async/forEachLimit');

var Configuration = require('../../Configuration.js');
var cst = require('../../../constants.js');
var Common = require('../../Common');
var NPM = require('./NPM.js')
var TAR = require('./TAR.js')
var LOCAL = require('./LOCAL.js')

var Modularizer = module.exports = {};

/**
 * PM2 Module System.
 */
Modularizer.install = function (CLI, module_name, opts, cb) {
  module_name = module_name.replace(/[;`|]/g, "");
  if (typeof(opts) == 'function') {
    cb = opts;
    opts = {};
  }

  if (LOCAL.INTERNAL_MODULES.hasOwnProperty(module_name)) {
    Common.logMod(`Adding dependency ${module_name} to PM2 Runtime`);
    var currentModule = LOCAL.INTERNAL_MODULES[module_name];
    if (currentModule && currentModule.hasOwnProperty('dependencies')) {
      LOCAL.installMultipleModules(currentModule.dependencies, cb);
    } else {
      LOCAL.install(currentModule, cb);
    }
  }
  else if (module_name == '.') {
    Common.logMod(`Installing local NPM module`);
    return NPM.localStart(CLI, opts, cb)
  }
  else if (opts.tarball || /\.tar\.gz$/i.test(module_name)) {
    Common.logMod(`Installing TAR module`);
    TAR.install(CLI, module_name, opts, cb)
  }
  else {
    Common.logMod(`Installing NPM ${module_name} module`);
    NPM.install(CLI, module_name, opts, cb)
  }
};

/**
 * Launch All Modules
 * Used PM2 at startup
 */
Modularizer.launchModules = function(CLI, cb) {
  var modules = Modularizer.listModules();

  if (!modules) return cb();

  // 1#
  function launchNPMModules(cb) {
    if (!modules.npm_modules) return launchTARModules(cb)

    eachLimit(Object.keys(modules.npm_modules), 1, function(module_name, next) {
      NPM.start(CLI, modules, module_name, next)
    }, function() {
      launchTARModules(cb)
    });
  }

  // 2#
  function launchTARModules(cb) {
    if (!modules.tar_modules) return cb()

    eachLimit(Object.keys(modules.tar_modules), 1, function(module_name, next) {
      TAR.start(CLI, module_name, next)
    }, function() {
      return cb ? cb(null) : false;
    });
  }

  launchNPMModules(cb)
}

Modularizer.package = function(CLI, module_path, cb) {
  var fullpath = process.cwd()
  if (module_path)
    fullpath = require('path').resolve(module_path)
  TAR.package(fullpath, process.cwd(), cb)
}

/**
 * Uninstall module
 */
Modularizer.uninstall = function(CLI, module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Uninstalling module ' + module_name);
  var modules_list = Modularizer.listModules();

  if (module_name == 'all') {
    if (!modules_list) return cb();

    return forEachLimit(Object.keys(modules_list.npm_modules), 1, function(module_name, next) {
      NPM.uninstall(CLI, module_name, next)
    }, () => {
      forEachLimit(Object.keys(modules_list.tar_modules), 1, function(module_name, next) {
        TAR.uninstall(CLI, module_name, next)
      }, cb)
    });
  }

  if (modules_list.npm_modules[module_name]) {
    NPM.uninstall(CLI, module_name, cb)
  } else if (modules_list.tar_modules[module_name]) {
    TAR.uninstall(CLI, module_name, cb)
  }
  else {
    Common.errMod('Unknown module')
    CLI.exitCli(1)
  }
};

/**
 * List modules based on modules present in ~/.pm2/modules/ folder
 */
Modularizer.listModules = function() {
  return {
    npm_modules: Configuration.getSync(cst.MODULE_CONF_PREFIX) || {},
    tar_modules: Configuration.getSync(cst.MODULE_CONF_PREFIX_TAR) || {}
  }
};

Modularizer.getAdditionalConf = function(app_name) {
  return NPM.getModuleConf(app_name)
};

Modularizer.publish = function(PM2, folder, opts, cb) {
  if (opts.npm == true) {
    NPM.publish(opts, cb)
  }
  else {
    TAR.publish(PM2, folder, cb)
  }
};

Modularizer.generateSample = function(app_name, cb) {
  NPM.generateSample(app_name, cb)
};
