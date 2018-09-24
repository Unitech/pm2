/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
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
var Rollback = require('./Rollback.js')
var StartModule = require('./StartModule.js')
var NPM = require('./NPM.js')
var TAR = require('./TAR.js')

var Modularizer = module.exports = {};

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

/**
 * PM2 Module System.
 * Features:
 * - Installed modules are listed separately from user applications
 * - Always ON, a module is always up along PM2, to stop it, you need to uninstall it
 * - Install a runnable module from NPM/Github/HTTP (require a package.json only)
 * - Some modules add internal PM2 depencencies (like typescript, profiling...)
 * - Internally it uses NPM install (https://docs.npmjs.com/cli/install)
 * - Auto discover script to launch (first it checks the apps field, then bin and finally main attr)
 * - Generate sample module via pm2 module:generate <module_name>
 */
Modularizer.install = function (CLI, moduleName, opts, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Installing module ' + moduleName);

  var canonicModuleName = Utility.getCanonicModuleName(moduleName);

  /**
   * Check if it's libraries to add to pm2 runtime on his node_modules folder
   */
  if (INTERNAL_MODULES.hasOwnProperty(moduleName)) {
    var currentModule = INTERNAL_MODULES[moduleName];

    if (currentModule && currentModule.hasOwnProperty('dependencies')) {
      Modularizer.installMultipleModules(currentModule.dependencies, cb);
    } else {
      installModuleByName(currentModule, cb);
    }
    return false;
  }

  /**
   * Install via NPM
   */
  moduleExistInLocalDB(CLI, canonicModuleName, function (exists) {
    if (exists) {
      // Update
      Common.printOut(cst.PREFIX_MSG_MOD + 'Module already installed. Updating.');

      // Create a backup
      Rollback.backup(moduleName);

      return uninstallModule(CLI, {
        module_name: canonicModuleName,
        deep_uninstall: false
      }, function () {
        return Modularizer.installModule(CLI, moduleName, opts, cb);
      });
    }

    // Install
    Modularizer.installModule(CLI, moduleName, opts, cb);
  });
};

/**
 * Install Module
 */
Modularizer.installModule = function(CLI, module_name, opts, cb) {
  var proc_path = '',
      cmd  = '',
      conf = {};

  if (typeof(opts) == 'function') {
    cb = opts;
    opts = {};
  }

  /*******************
   * Development mode (local module with auto watch restart)
   *******************/
  if (module_name == '.') {
    Common.printOut(cst.PREFIX_MSG_MOD + 'Installing local module in DEVELOPMENT MODE with WATCH auto restart');
    proc_path = process.cwd();

    cmd = p.join(proc_path, cst.DEFAULT_MODULE_JSON);

    Common.extend(opts, {
      cmd : cmd,
      development_mode : true,
      proc_path : proc_path
    });

    return StartModule(CLI, opts, function(err, dt) {
      if (err) return cb(err);
      Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
      return cb(null, dt);
    });
  }

  /******************
   * Production mode
   ******************/
  if (opts.tarball || module_name.indexOf('.tar.gz') > -1) {
    TAR.install(CLI, module_name, opts, cb)
  }
  else {
    NPM.install(CLI, module_name, opts, cb)
  }
}

/**
 * Launch All Modules
 * Used PM2 at startup
 */
Modularizer.launchModules = function(CLI, cb) {
  var modules = Modularizer.listModules();

  if (!modules) return cb();

  function launchNPMModules(cb) {
    if (!modules.npm_modules) return launchTARModules(cb)

    eachLimit(Object.keys(modules.npm_modules), 1, function(module_name, next) {
      Common.printOut(cst.PREFIX_MSG_MOD + 'Starting NPM module ' + module_name);

      var install_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);
      var proc_path = path.join(install_path, 'node_modules', module_name);
      var package_json_path = path.join(proc_path, 'package.json');

      var opts = {};

      // Merge with embedded configuration inside module_conf (uid, gid)
      Common.extend(opts, modules[module_name]);

      // Merge meta data to start module properly
      Common.extend(opts, {
        // package.json path
        cmd : package_json_path,
        // starting mode
        development_mode : false,
        // process cwd
        proc_path : proc_path
      });

      StartModule(CLI, opts, function(err, dt) {
        if (err) console.error(err);
        return next();
      });

    }, function() {
      launchTARModules(cb)
    });
  }

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

/**
 * Uninstall module
 */
Modularizer.uninstall = function(CLI, module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Uninstalling module ' + module_name);

  if (module_name == 'all') {
    var modules = Modularizer.listModules();

    if (!modules) return cb();

    return forEachLimit(Object.keys(modules.npm_modules), 1, function(module_name, next) {
      NPM.uninstall(CLI, module_name, next)
    }, () => {
      forEachLimit(Object.keys(modules.tar_modules), 1, function(module_name, next) {
        TAR.uninstall(CLI, module_name, next)
      }, cb)
    });
  }

  uninstallModule(CLI, module_name, cb)
};

function uninstallModule(CLI, module_name, cb) {
  var module_list = Modularizer.listModules()

  if (module_list.npm_modules[module_name]) {
    NPM.uninstall(CLI, module_name, cb)
  } else if (module_list.tar_modules[module_name]) {
    TAR.uninstall(CLI, module_name, cb)
  }
  else {
    Common.err('Unknown module')
    CLI.exitCli(1)
  }
}

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
  if (!app_name) throw new Error('No app_name defined');

  var module_conf = Configuration.getAllSync();

  var additional_env = {};

  if (!module_conf[app_name]) {
    additional_env = {};
    additional_env[app_name] = {};
  }
  else {
    additional_env = Common.clone(module_conf[app_name]);
    additional_env[app_name] = JSON.stringify(module_conf[app_name]);
  }
  return additional_env;
};


Modularizer.installMultipleModules = function (modules, cb, post_install) {
  var functionList = [];
  for (var i = 0; i < modules.length; i++) {
    functionList.push((function (index) {
      return function (callback) {
        var module = modules[index];
        if (typeof modules[index] === 'string') {
          module = {name: modules[index]};
        }
        installModuleByName(module, function ($post_install, err, $index, $modules) {
          try
          {
            var install_instance = spawn(post_install[modules[index]], {
              stdio : 'inherit',
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

/**
 * Publish a module
 */
Modularizer.publish = function(cb) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  var semver = require('semver');

  var package_file = p.join(process.cwd(), 'package.json');

  var package_json = require(package_file);

  package_json.version = semver.inc(package_json.version, 'minor');
  Common.printOut(cst.PREFIX_MSG_MOD + 'Incrementing module to: %s@%s',
                  package_json.name,
                  package_json.version);


  rl.question("Write & Publish? [Y/N]", function(answer) {
    if (answer != "Y")
      return cb();


    fs.writeFile(package_file, JSON.stringify(package_json, null, 2), function(err, data) {
      if (err) return cb(err);

      Common.printOut(cst.PREFIX_MSG_MOD + 'Publishing module - %s@%s',
                      package_json.name,
                      package_json.version);

      require('shelljs').exec('npm publish', function(code) {
        Common.printOut(cst.PREFIX_MSG_MOD + 'Module - %s@%s successfully published',
                        package_json.name,
                        package_json.version);

        Common.printOut(cst.PREFIX_MSG_MOD + 'Pushing module on Git');
        require('shelljs').exec('git add . ; git commit -m "' + package_json.version + '"; git push origin master', function(code) {

          Common.printOut(cst.PREFIX_MSG_MOD + 'Installable with pm2 install %s', package_json.name);
          return cb(null, package_json);
        });
      });
    });

  });
};

Modularizer.generateSample = function(app_name, cb) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function samplize(module_name) {
    var cmd1 = 'git clone https://github.com/pm2-hive/sample-module.git ' + module_name + '; cd ' + module_name + '; rm -rf .git';
    var cmd2 = 'cd ' + module_name + ' ; sed -i "s:sample-module:'+ module_name  +':g" package.json';
    var cmd3 = 'cd ' + module_name + ' ; npm install';

    Common.printOut(cst.PREFIX_MSG_MOD + 'Getting sample app');
    require('shelljs').exec(cmd1, function(err) {
      if (err) Common.printError(cst.PREFIX_MSG_MOD_ERR + err.message);
      require('shelljs').exec(cmd2, function(err) {
        console.log('');
        require('shelljs').exec(cmd3, function(err) {
          console.log('');
          Common.printOut(cst.PREFIX_MSG_MOD + 'Module sample created in folder: ', path.join(process.cwd(), module_name));
          console.log('');
          Common.printOut('Start module in development mode:');
          Common.printOut('$ cd ' + module_name + '/');
          Common.printOut('$ pm2 install . ');
          console.log('');

          Common.printOut('Module Log: ');
          Common.printOut('$ pm2 logs ' + module_name);
          console.log('');
          Common.printOut('Uninstall module: ');
          Common.printOut('$ pm2 uninstall ' + module_name);
          console.log('');
          Common.printOut('Force restart: ');
          Common.printOut('$ pm2 restart ' + module_name);
          return cb ?  cb() : false;
        });
      });
    });
  }

  if (app_name) return samplize(app_name);

  rl.question(cst.PREFIX_MSG_MOD + "Module name: ", function(module_name) {
    samplize(module_name);
  });
};

function installModuleByName (module, cb, verbose) {
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

function moduleExistInLocalDB(CLI, module_name, cb) {
  var modules = Configuration.getSync(cst.MODULE_CONF_PREFIX);
  if (!modules) return cb(false);
  modules = Object.keys(modules);
  return cb(modules.indexOf(module_name) > -1 ? true : false);
};
