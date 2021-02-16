
var path          = require('path');
var fs            = require('fs');
var os            = require('os');
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');
var parallel      = require('async/parallel');

var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');
var readline = require('readline')

var INTERNAL_MODULES = {
  'deep-monitoring': {
    dependencies: [{name: 'v8-profiler-node8'}, {name: 'gc-stats'}, {name: 'event-loop-inspector'}]
  },
  'gc-stats': {name: 'gc-stats'},
  'event-loop-inspector': {name: 'event-loop-inspector'},
  'v8-profiler': {name: 'v8-profiler-node8'},
  'profiler': {name: 'v8-profiler-node8'},
  'typescript': {dependencies: [{name: 'typescript'}, {name: 'ts-node@latest'}]},
  'livescript': {name: 'livescript'},
  'coffee-script': {name: 'coffee-script', message: 'Coffeescript v1 support'},
  'coffeescript': {name: 'coffeescript', message: 'Coffeescript v2 support'}
};

module.exports = {
  install,
  INTERNAL_MODULES,
  installMultipleModules
}


function install(module, cb, verbose) {
  if (!module || !module.name || module.name.length === 0) {
    return cb(new Error('No module name !'));
  }

  if (typeof verbose === 'undefined') {
    verbose = true;
  }

  installLangModule(module.name, function (err) {
    var display = module.message || module.name;
    if (err) {
      if (verbose) { Common.printError(cst.PREFIX_MSG_MOD_ERR + chalk.bold.green(display + ' installation has FAILED (checkout previous logs)')); }
      return cb(err);
    }

    if (verbose) { Common.printOut(cst.PREFIX_MSG + chalk.bold.green(display + ' ENABLED')); }
    return cb();
  });
}

function installMultipleModules(modules, cb, post_install) {
  var functionList = [];
  for (var i = 0; i < modules.length; i++) {
    functionList.push((function (index) {
      return function (callback) {
        var module = modules[index];
        if (typeof modules[index] === 'string') {
          module = {name: modules[index]};
        }
        install(module, function ($post_install, err, $index, $modules) {
          try {
            var install_instance = spawn(post_install[modules[index]], {
              stdio : 'inherit',
              windowsHide: true,
              env: process.env,
              shell : true,
              cwd : process.cwd()
            });
            Common.printOut(cst.PREFIX_MSG_MOD + 'Running configuraton script.');
          }
          catch(e)
          {
            Common.printOut(cst.PREFIX_MSG_MOD + 'No configuraton script found.');
          }
          callback(null, {  module: module, err: err });
        }, false);
      };
    })(i));
  }

  parallel(functionList, function (err, results) {
    for (var i = 0; i < results.length; i++) {
      var display = results[i].module.message || results[i].module.name;
      if (results[i].err) {
        err = results[i].err;
        Common.printError(cst.PREFIX_MSG_MOD_ERR + chalk.bold.green(display + ' installation has FAILED (checkout previous logs)'));
      } else {
        Common.printOut(cst.PREFIX_MSG + chalk.bold.green(display + ' ENABLED'));
      }
    }

    if(cb) cb(err);
  });
};

function installLangModule(module_name, cb) {
  var node_module_path = path.resolve(path.join(__dirname, '../../../'));
  Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[NPM]') + ' to install ' + module_name + ' ...');

  var install_instance = spawn(cst.IS_WINDOWS ? 'npm.cmd' : 'npm', ['install', module_name, '--loglevel=error'], {
    stdio : 'inherit',
    env: process.env,
		shell : true,
    cwd : node_module_path
  });

  install_instance.on('close', function(code) {
    if (code > 0)
      return cb(new Error('Module install failed'));
    return cb(null);
  });

  install_instance.on('error', function (err) {
    console.error(err.stack || err);
  });
};
