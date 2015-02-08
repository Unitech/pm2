
var Modularizer = module.exports = {};

var shelljs = require('shelljs');
var path    = require('path');
var fs      = require('fs');
var async   = require('async');
var p       = path;

var cst     = require('../constants.js');
var CLI     = require('./CLI.js');
var Common  = require('./Common');
var UX      = require('./CliUx.js');

// [X] 1# verify that there is a process.json or process.json5 else not a pm2 module
// [X] 2# Keep separated list for modules when doing pm2 list
// [X] Avoid dumping module processes
// [X] Stats process.json process.json5 package.json ecosystem.json
// [X] 4# pm2 uninstall <probe> = delete folder and stop process
// [X] Name of app must be the same than the module name
// [X] At PM2 initialization start all .pm2/node_modules
// [X] Block all tentatives to stop a module
// pm2 generate module   = Provide a module skeleton

Modularizer.launchAll = function(cb) {
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');

  shelljs.config.silent = true;
  var modules = shelljs.ls('-A', module_folder);
  shelljs.config.silent = false;

  async.eachLimit(modules, 1, function(module, next) {
    var pmod = p.join(module_folder, module, cst.DEFAULT_MODULE_JSON);

    Common.printOut(cst.PREFIX_MSG_MOD + 'Starting module ' + module);

    CLI.startJson(pmod, {
      watch : true,
      cwd : p.join(module_folder, module),
      force_name : module,
      started_as_module : true
    }, function(err, data) {
      return next();
    });
  }, function() {
    return cb ? cb() : false;
  });
};

Modularizer.install = function(module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Installing module ' + module_name);

  if (moduleExist(module_name) === true) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'Module already installed. Installation canceled.');
    return cb({msg:'Module already installed'});
  }

  Common.printOut(cst.PREFIX_MSG_MOD + 'Processing...');

  var child = shelljs.exec('npm install ' + module_name + ' --prefix ' + cst.PM2_ROOT_PATH);

  if (child.code != 0) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'Unknown module');
    return cb({msg:'Unknown module'});
  }

  Common.printOut(cst.PREFIX_MSG_MOD + 'Module downloaded');

  var path = p.join(cst.PM2_ROOT_PATH, 'node_modules', module_name);
  var cmd  = p.join(path, cst.DEFAULT_MODULE_JSON);

  if (isValidModule(path) === false) {
    shelljs.rm('-rf', path);
    Common.printError(cst.PREFIX_MSG_MOD + 'Module uninstalled');
    return cb({msg:'Invalid module'});
  }

  CLI.startJson(cmd, {
    watch : true,
    cwd : path,
    force_name: module_name,
    started_as_module : true
  }, function(err, data) {
    if (err) {
      return cb(err);
    }

    Common.printOut(cst.PREFIX_MSG_MOD + 'Configure module (if needed): %s', cmd);
    Common.printOut(cst.PREFIX_MSG_MOD + 'Module succesfully installed and launched');
    return cb(null, data);
  });

};

Modularizer.uninstall = function(module_name, cb) {
  var path = p.join(cst.PM2_ROOT_PATH, 'node_modules', module_name);
  var cmd  = p.join(path, cst.DEFAULT_MODULE_JSON);

  Common.printOut(cst.PREFIX_MSG_MOD + 'Uninstalling module ' + module_name);

  try {
    process.chdir(path);
  } catch(e) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'Unknown module');
    return cb({msg: 'Unknown module'});
  }


  CLI.deleteModule(module_name, function(err, data) {
    if (err) {
      Common.printError(cst.PREFIX_MSG_MOD_ERR + err);
      return cb(err);
    }

    shelljs.rm('-rf', path);
    return cb();
  });
};

function isValidModule(path) {
  var valid = true;

  try {
    fs.existsSync(p.join(path, 'package.json'));
    fs.existsSync(p.join(path, 'conf.js'));
  } catch(e) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'package.json or conf.js file not present');
    return false;
  }

  var conf = require(p.join(path, 'package.json'));

  if (!conf.apps) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'apps attribute indicating the script to launch is not defined in the package.json');
    return false;
  }

  conf.apps.forEach(function(app) {
    if (!app.script)
      valid = false;
  });

  return valid;
};

function moduleExist(module_name) {
  var modules = getModuleInstalled();
  return modules.indexOf(module_name) > -1 ? true : false;
};

function getModuleInstalled() {
  shelljs.config.silent = true;
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');
  var modules       = shelljs.ls('-A', module_folder);
  shelljs.config.silent = false;
  return modules;
}
