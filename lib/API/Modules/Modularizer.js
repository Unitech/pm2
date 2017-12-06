/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var shelljs       = require('shelljs');
var path          = require('path');
var fs            = require('fs');
var async         = require('async');
var p             = path;
var readline      = require('readline');
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');
var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');
var ModularizerV1 = require('./Modularizerv1.js');
var Modularizer = module.exports = {};

var MODULE_CONF_PREFIX = 'module-db-v2';

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
Modularizer.install = function(CLI, module_name, opts, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Installing module ' + module_name);

  var canonic_module_name = Utility.getCanonicModuleName(module_name);

  if (module_name == 'v8-profiler' || module_name == 'profiler') {
    installLangModule('v8-profiler-node8', function(err) {
      if (err) {
        Common.printError(cst.PREFIX_MSG_MOD_ERR + chalk.bold.green('Profiling installation has FAILED (checkout previous logs)'));
        return cb(err);
      }

      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('V8 profiling ENABLED'));
      return cb();
    });
    return false;
  }

  if (module_name.indexOf('typescript') > -1) {
    // Special dependency install
    return installLangModule(module_name, function(e) {
      installLangModule('ts-node@latest', function(e) {
        Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Typescript support enabled'));
        return cb(e);
      });
    });
  }

  if (module_name == 'livescript') {
    return installLangModule('livescript', function(e) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Livescript support enabled'));
      return cb(e);
    });
  }

  if (module_name.indexOf('coffee-script') > -1) {
    return installLangModule(module_name, function(e) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Coffeescript v1 support enabled'));
      return cb(e);
    });
  }

  if (module_name.indexOf('coffeescript') > -1) {
    return installLangModule(module_name, function(e) {
      Common.printOut(cst.PREFIX_MSG + chalk.bold.green('Coffeescript v2 support enabled'));
      return cb(e);
    });
  }

  moduleExist(CLI, canonic_module_name, function(exists) {
    if (exists) {
      // Update
      Common.printOut(cst.PREFIX_MSG_MOD + 'Module already installed. Updating.');

      // Create a backup
      Rollback.backup(module_name);

      return uninstallModule(CLI, {
        module_name : canonic_module_name,
        deep_uninstall : false
      }, function(err) {
        return Modularizer.installModule(CLI, module_name, opts, cb);
      });
    }

    // Install
    Modularizer.installModule(CLI, module_name, opts, cb);
  })
};

Modularizer.installModule = function(CLI, module_name, opts, cb) {
  var proc_path = '',
      cmd  = '',
      conf = {},
      development_mode = false;

  if (typeof(opts) == 'function') {
    cb = opts;
    opts = {};
  }

  if (module_name == '.') {
    /*******************
     * Development mode
     *******************/
    Common.printOut(cst.PREFIX_MSG_MOD + 'Installing local module in DEVELOPMENT MODE with WATCH auto restart');
    development_mode = true;
    proc_path = process.cwd();

    cmd = p.join(proc_path, cst.DEFAULT_MODULE_JSON);

    Common.extend(opts, {
      cmd : cmd,
      development_mode : development_mode,
      proc_path : proc_path
    });

    return startModule(CLI, opts, function(err, dt) {
      if (err) return cb(err);
      Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
      return cb(null, dt);
    });
  }

  /******************
   * Production mode
   ******************/
  Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[NPM]') + ' to install ' + module_name + ' ...');

  var canonic_module_name = Utility.getCanonicModuleName(module_name);
  var install_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);

  var install_instance = spawn(cst.IS_WINDOWS ? 'npm.cmd' : 'npm', ['install', module_name, '--loglevel=error', '--prefix', install_path ], {
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
      // If install has failed, revert to previous module version
      return Rollback.revert(CLI, module_name, function() {
        return cb(new Error('Installation failed via NPM, module has been restored to prev version'));
      });
    }

    Common.printOut(cst.PREFIX_MSG_MOD + 'Module downloaded');

    var proc_path = path.join(install_path, 'node_modules', canonic_module_name);
    var package_json_path = path.join(proc_path, 'package.json');

    // Append default configuration to module configuration
    try {
      var conf = JSON.parse(fs.readFileSync(package_json_path).toString()).config;

      if (conf) {
        Object.keys(conf).forEach(function(key) {
          Configuration.setSyncIfNotExist(canonic_module_name + ':' + key, conf[key]);
        });
      }
    } catch(e) {
      Common.printError(e);
    }

    opts = Common.extend(opts, {
      cmd : package_json_path,
      development_mode : development_mode,
      proc_path : proc_path
    });

    Configuration.set(MODULE_CONF_PREFIX + ':' + canonic_module_name, {
      uid : opts.uid,
      gid : opts.gid
    }, function(err, data) {
      if (err) return cb(err);

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

// Start V1 and V2 modules
Modularizer.launchAll = function(CLI, cb) {
  ModularizerV1.launchModules(CLI, function() {
    Modularizer.launchModules(CLI, cb);
  });
};

Modularizer.launchModules = function(CLI, cb) {
  var modules = Modularizer.listModules();

  if (!modules) return cb();

  async.eachLimit(Object.keys(modules), 1, function(module_name, next) {
    Common.printOut(cst.PREFIX_MSG_MOD + 'Starting module ' + module_name);

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

    startModule(CLI, opts, function(err, dt) {
      if (err) console.error(err);
      return next();
    });

  }, function() {
    return cb ? cb(null) : false;
  });
}


function startModule(CLI, opts, cb) {
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

  Common.extend(opts, {
    cwd               : opts.proc_path,
    watch             : opts.development_mode,
    force_name        : package_json.name,
    started_as_module : true
  });

  // Start the module
  CLI.start(package_json, opts, function(err, data) {
    if (err) return cb(err);

    Common.printOut(cst.PREFIX_MSG_MOD + 'Monitoring module behavior for potential issue (5secs...)');

    if (opts.safe) {
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

/**
 * Uninstall module
 */
Modularizer.uninstall = function(CLI, module_name, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Uninstalling module ' + module_name);

  if (module_name == 'all') {
    var modules = Modularizer.listModules();

    if (!modules) return cb();

    return async.forEachLimit(Object.keys(modules), 1, function(module_name, next) {
      uninstallModule(CLI, {
        module_name : module_name,
        deep_uninstall : true
      }, next);
    }, cb);
  }

  var canonic_module_name = Utility.getCanonicModuleName(module_name);

  uninstallModule(CLI, {
    module_name : canonic_module_name,
    deep_uninstall : true
  }, cb);
};

function uninstallModule(CLI, opts, cb) {
  var module_name = opts.module_name;
  var proc_path = p.join(cst.PM2_ROOT_PATH, 'node_modules', module_name);

  try {
    // v1 uninstallation
    fs.statSync(proc_path)
    if (opts.deep_uninstall == true)
      Configuration.unsetSync('module-db:' + module_name);
  } catch(e) {
    proc_path = p.join(cst.DEFAULT_MODULE_PATH, module_name);
    if (opts.deep_uninstall == true)
      Configuration.unsetSync(MODULE_CONF_PREFIX + ':' + module_name);
  }

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

var Rollback = {
  revert : function(CLI, module_name, cb) {
    var canonic_module_name = Utility.getCanonicModuleName(module_name);
    var backup_path = path.join(require('os').tmpdir(), canonic_module_name);
    var module_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);

    try {
      fs.statSync(backup_path)
    } catch(e) {
      return cb(new Error('no backup found'));
    }

    Common.printOut(cst.PREFIX_MSG_MOD + chalk.bold.red('[[[[[ Module installation failure! ]]]]]'));
    Common.printOut(cst.PREFIX_MSG_MOD + chalk.bold.red('[RESTORING TO PREVIOUS VERSION]'));

    CLI.deleteModule(canonic_module_name, function() {
      // Delete failing module
      shelljs.rm('-r', module_path);
      // Restore working version
      shelljs.cp('-r', backup_path, module_path);

      var proc_path = path.join(module_path, 'node_modules', canonic_module_name);
      var package_json_path = path.join(proc_path, 'package.json');

      // Start module
      startModule(CLI, {
        cmd : package_json_path,
        development_mode : false,
        proc_path : proc_path
      }, cb);
    });
  },
  backup : function(module_name) {
    // Backup current module
    var tmpdir = require('os').tmpdir();
    var canonic_module_name = Utility.getCanonicModuleName(module_name);
    var module_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);
    shelljs.cp('-r', module_path, tmpdir);
  }
}

/**
 * List modules based on modules present in ~/.pm2/modules/ folder
 */
Modularizer.listModules = function() {
  return Configuration.getSync(MODULE_CONF_PREFIX);
};

// Expose old module installation method for testing purpose
Modularizer.installModuleV1 = ModularizerV1.installModule;

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

function moduleExist(CLI, module_name, cb) {
  // If old module, force his deletion
  var modules_v1 = Configuration.getSync('module-db');

  if (modules_v1) {
    modules_v1 = Object.keys(modules_v1);
    if (modules_v1.indexOf(module_name) > -1) {
      return uninstallModule(CLI, {
        module_name : module_name,
        deep_uninstall : true
      }, function() {
        cb(false);
      });
    }
  }

  var modules = Configuration.getSync(MODULE_CONF_PREFIX);
  if (!modules) return cb(false);
  modules = Object.keys(modules);
  return cb(modules.indexOf(module_name) > -1 ? true : false);
};
