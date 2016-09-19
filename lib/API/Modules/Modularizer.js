/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var shelljs  = require('shelljs');
var path     = require('path');
var fs       = require('fs');
var async    = require('async');
var p        = path;
var readline = require('readline');
var spawn    = require('child_process').spawn;
var chalk    = require('chalk');
var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var UX            = require('../CliUx.js');
var Utility       = require('../../Utility.js');

var Modularizer = module.exports = {};

var MODULE_CONF_PREFIX = 'module-db';

function startModule(CLI, opts, cb) {
  /** SCRIPT
   * Open file and make the script detection smart
   */

  if (!opts.cmd) throw new Error('module package.json not defined');
  if (!opts.development_mode) opts.development_mode = false;

  var package_json = require(opts.cmd);

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

  /**
   * Verify that the module is valid
   * If not, delete
   */
  if (isValidModule(package_json) === false) {
    if (!opts.development_mode) shelljs.rm('-rf', opts.proc_pabth);
    Common.printError(cst.PREFIX_MSG_MOD + 'Module uninstalled');
    return cb(new Error('Invalid module (script is missing)'));
  }

  // Start the module
  CLI.start(package_json, {
    cwd               : opts.proc_path,
    watch             : opts.development_mode,
    force_name        : package_json.name,
    started_as_module : true
  }, function(err, data) {
    if (err) return cb(err);
    return cb(null, data);
  });
};

function installModule(CLI, module_name, cb) {
  var proc_path = '',
      cmd  = '',
      conf = {},
      development_mode = false;

  if (module_name == '.') {
    /**
     * Development mode
     */
    Common.printOut(cst.PREFIX_MSG_MOD + 'Installing local module in DEVELOPMENT MODE with WATCH auto restart');
    development_mode = true;
    proc_path = process.cwd();

    cmd = p.join(proc_path, cst.DEFAULT_MODULE_JSON);

    startModule(CLI, {
      cmd : cmd,
      development_mode : development_mode,
      proc_path : proc_path
    }, function(err, dt) {
      if (err) return cb(err);
      Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
      return cb(null, dt);
    });
  }
  else {
    /**
     * Production mode
     */

    //UX.processing.start('Downloading module');
    Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[NPM]') + ' registry...');
    var install_instance;

    install_instance = spawn(cst.IS_WINDOWS ? 'npm.cmd' : 'npm', [
      'install', module_name, '--prefix', cst.PM2_ROOT_PATH, '--loglevel=error'
    ],{
      stdio : 'inherit',
      env: process.env,
			shell : true
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

      if (module_name.match(/\.tgz($|\?)/)) {
        module_name = Utility.packageNameToModuleName(module_name);
      }
      else if (module_name.indexOf('/') != -1)
        module_name = module_name.split('/')[1];

      //pm2 install module@2.1.0-beta
      if(module_name.indexOf('@') != -1)
        module_name = module_name.split('@')[0]

      proc_path = p.join(cst.PM2_ROOT_PATH, 'node_modules', module_name);

      cmd = p.join(proc_path, cst.DEFAULT_MODULE_JSON);

      Configuration.set(MODULE_CONF_PREFIX + ':' + module_name, 'true', function(err, data) {
        startModule(CLI, {
          cmd : cmd,
          development_mode : development_mode,
          proc_path : proc_path
        }, function(err, dt) {
          if (err) return cb(err);
          Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
          Common.printOut(cst.PREFIX_MSG_MOD + ': To configure module do');
          Common.printOut(cst.PREFIX_MSG_MOD + ': $ pm2 conf <key> <value>');
          return cb(null, dt);
        });
      });
    }
  }
}

function uninstallModule(CLI, module_name, cb) {
  var proc_path = p.join(cst.PM2_ROOT_PATH, 'node_modules', module_name);

  Configuration.unsetSync(MODULE_CONF_PREFIX + ':' + module_name);

  CLI.deleteModule(module_name, function(err, data) {
    if (err) {
      Common.printError(err);

      if (module_name != '.') {
        console.log(proc_path);
        shelljs.rm('-r', proc_path);
      }

      return cb(err);
    }

    if (module_name != '.') {
      shelljs.rm('-r', proc_path);
    }

    return cb(null, data);
  });
}

function installLangModule(module_name, cb) {
  var node_module_path = path.join(__dirname, '../../..');

  var install_instance = spawn(cst.IS_WINDOWS ? 'npm.cmd' : 'npm', [
    'install', module_name, '--prefix', node_module_path, '--loglevel=error'
  ],{
    stdio : 'inherit',
    env: process.env,
	  shell : true
  });

  install_instance.on('close', function done() {
    cb(null);
  });

  install_instance.on('error', function (err) {
    console.error(err.stack || err);
  });
};

/**
 * List modules on the old way
 */
var listModules = function() {
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');
  var ret = [];

  shelljs.config.silent = true;
  var modules = shelljs.ls(module_folder);
  shelljs.config.silent = false;

  modules.forEach(function(module_name) {
    if (module_name.indexOf('pm2-') > -1)
      ret.push(module_name);
  });

  return ret;
};

/**
 * List modules based on internal database
 */
var listModulesV2 = Modularizer.listModules = function() {
  var config = Configuration.getSync(MODULE_CONF_PREFIX);

  if (!config) {
    var modules_already_installed = listModules();

    modules_already_installed.forEach(function(module_name) {
      Configuration.setSync(MODULE_CONF_PREFIX + ':' + module_name, true);
    });
    return modules_already_installed;
  }

  return Object.keys(config);
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

Modularizer.launchAll = function(CLI, cb) {
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');

  var modules = listModulesV2();

  async.eachLimit(modules, 1, function(module, next) {
    var pmod = p.join(module_folder, module, cst.DEFAULT_MODULE_JSON);

    Common.printOut(cst.PREFIX_MSG_MOD + 'Starting module ' + module);

    startModule(CLI, {
      cmd : pmod,
      development_mode : false,
      proc_path : p.join(module_folder, module)
    }, function(err, dt) {
      if (err) console.error(err);
      return next();
    });

  }, function() {
    return cb ? cb(null) : false;
  });
};

Modularizer.install = function(CLI, module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Installing module ' + module_name);

  var canonic_module_name = Utility.packageNameToModuleName(module_name);

  if (module_name == 'typescript') {
    // Special dependency install
    installLangModule('typescript', function(e) {
      installLangModule('ts-node@latest', function(e) {
        Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Typescript support enabled'));
        return cb();
      });
    });
    return false;
  }

  if (module_name == 'livescript') {
    installLangModule('livescript', function(e) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Livescript support enabled'));
      return cb();
    });
    return false;
  }

  if (module_name == 'coffeescript') {
    installLangModule('coffee-script', function(e) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Coffeescript support enabled'));
      return cb();
    });
    return false;
  }


  if (moduleExist(canonic_module_name) === true) {
    /**
     * Update
     */
    Common.printOut(cst.PREFIX_MSG_MOD + 'Module already installed. Updating.');

    uninstallModule(CLI, canonic_module_name, function(err) {
      return installModule(CLI, module_name, cb);
    });

    return false;
  }

  /**
   * Install
   */
  installModule(CLI, module_name, cb);
};

/**
 * Uninstall module
 */
Modularizer.uninstall = function(CLI, module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Uninstalling module ' + module_name);

  //if (moduleExist(module_name) === false && module_name != '.') {
  //Common.printError(cst.PREFIX_MSG_MOD_ERR + 'Module unknown.');
  //return cb({msg:'Module unknown'});
  //}
  if (module_name == 'all') {
    var modules = listModulesV2();
    async.forEachLimit(modules, 1, function(module, next) {
      uninstallModule(CLI, module, next);
    }, cb);
    return false;
  }

  uninstallModule(CLI, module_name, cb);
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

      shelljs.exec('npm publish', function(code) {
        Common.printOut(cst.PREFIX_MSG_MOD + 'Module - %s@%s successfully published',
                        package_json.name,
                        package_json.version);

        Common.printOut(cst.PREFIX_MSG_MOD + 'Pushing module on Git');
        shelljs.exec('git add . ; git commit -m "' + package_json.version + '"; git push origin master', function(code) {

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
    shelljs.exec(cmd1, function(err) {
      if (err) Common.printError(cst.PREFIX_MSG_MOD_ERR + err.message);
      shelljs.exec(cmd2, function(err) {
        console.log('');
        shelljs.exec(cmd3, function(err) {
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

function isValidModule(conf) {
  var valid = true;

  if (!conf.apps) {
    Common.printError(cst.PREFIX_MSG_MOD_ERR + 'apps attribute indicating the script to launch is not defined in the package.json');
    return false;
  }

  if (Array.isArray(conf.apps)) {
    conf.apps.forEach(function(app) {
      if (!app.script)
        valid = false;
    });
  }
  else {
    if (!conf.apps.script)
      valid = false;
  }

  return valid;
};

function moduleExist(module_name) {
  var modules = getModuleInstalled();

  if (module_name.indexOf('/') > -1)
    module_name = module_name.split('/')[1];

  return modules.indexOf(module_name) > -1 ? true : false;
};

function getModuleInstalled() {
  shelljs.config.silent = true;
  var module_folder = p.join(cst.PM2_ROOT_PATH, 'node_modules');
  var modules       = shelljs.ls('-A', module_folder);
  shelljs.config.silent = false;
  return modules;
}
