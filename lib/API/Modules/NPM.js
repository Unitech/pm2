var path          = require('path');
var fs            = require('fs');
var os            = require('os');
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');

var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');
var readline = require('readline')

module.exports = {
  install,
  uninstall,
  start,
  publish,
  generateSample,
  localStart,
  getModuleConf
}

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

function localStart(PM2, opts, cb) {
  var proc_path = '',
      cmd  = '',
      conf = {};

  Common.printOut(cst.PREFIX_MSG_MOD + 'Installing local module in DEVELOPMENT MODE with WATCH auto restart');
  proc_path = process.cwd();

  cmd = path.join(proc_path, cst.DEFAULT_MODULE_JSON);

  Common.extend(opts, {
    cmd : cmd,
    development_mode : true,
    proc_path : proc_path
  });

  return StartModule(PM2, opts, function(err, dt) {
    if (err) return cb(err);
    Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
    return cb(null, dt);
  });
}

function generateSample(app_name, cb) {
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
}

function publish(opts, cb) {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  var semver = require('semver');

  var package_file = path.join(process.cwd(), 'package.json');

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
}

function moduleExistInLocalDB(CLI, module_name, cb) {
  var modules = Configuration.getSync(cst.MODULE_CONF_PREFIX);
  if (!modules) return cb(false);
  var module_name_only = Utility.getCanonicModuleName(module_name)
  modules = Object.keys(modules);
  return cb(modules.indexOf(module_name_only) > -1 ? true : false);
};

function install(CLI, module_name, opts, cb) {
  moduleExistInLocalDB(CLI, module_name, function (exists) {
    if (exists) {
      Common.logMod('Module already installed. Updating.');

      Rollback.backup(module_name);

      return uninstall(CLI, module_name, function () {
        return continueInstall(CLI, module_name, opts, cb);
      });
    }
    return continueInstall(CLI, module_name, opts, cb);
  })
}

// Builtin Node Switch
function getNPMCommandLine(module_name, install_path) {
  if (require('shelljs').which('npm')) {
    return spawn.bind(this, cst.IS_WINDOWS ? 'npm.cmd' : 'npm', ['install', module_name, '--loglevel=error', '--prefix', `"${install_path}"` ], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    })
  }
  else {
    return spawn.bind(this, cst.BUILTIN_NODE_PATH, [cst.BUILTIN_NPM_PATH, 'install', module_name, '--loglevel=error', '--prefix', `"${install_path}"`], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    })
  }
}

function continueInstall(CLI, module_name, opts, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[NPM]') + ' to install ' + module_name + ' ...');

  var canonic_module_name = Utility.getCanonicModuleName(module_name);
  var install_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);

  require('mkdirp')(install_path, function() {
    process.chdir(os.homedir());

    var install_instance = getNPMCommandLine(module_name, install_path)();

    install_instance.on('close', finalizeInstall);

    install_instance.on('error', function (err) {
      console.error(err.stack || err);
    });
  });

  function finalizeInstall(code) {
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
      development_mode : false,
      proc_path : proc_path
    });

    Configuration.set(cst.MODULE_CONF_PREFIX + ':' + canonic_module_name, {
      uid : opts.uid,
      gid : opts.gid
    }, function(err, data) {
      if (err) return cb(err);

      StartModule(CLI, opts, function(err, dt) {
        if (err) return cb(err);

        if (process.env.PM2_PROGRAMMATIC === 'true')
          return cb(null, dt);

        CLI.conf(canonic_module_name, function() {
          Common.printOut(cst.PREFIX_MSG_MOD + 'Module successfully installed and launched');
          Common.printOut(cst.PREFIX_MSG_MOD + 'Checkout module options: `$ pm2 conf`');
          return cb(null, dt);
        });
      });
    });
  }
}

function start(PM2, modules, module_name, cb) {
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

  StartModule(PM2, opts, function(err, dt) {
    if (err) console.error(err);
    return cb();
  })
}

function uninstall(CLI, module_name, cb) {
  var module_name_only = Utility.getCanonicModuleName(module_name)
  var proc_path = path.join(cst.DEFAULT_MODULE_PATH, module_name_only);
  Configuration.unsetSync(cst.MODULE_CONF_PREFIX + ':' + module_name_only);

  CLI.deleteModule(module_name_only, function(err, data) {
    if (err) {
      Common.printError(err);

      if (module_name != '.') {
        console.log(proc_path);
        require('shelljs').rm('-r', proc_path);
      }

      return cb(err);
    }

    if (module_name != '.') {
      require('shelljs').rm('-r', proc_path);
    }

    return cb(null, data);
  });
}

function getModuleConf(app_name) {
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
}

function StartModule(CLI, opts, cb) {
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
      require('shelljs').rm('-r', module_path);
      // Restore working version
      require('shelljs').cp('-r', backup_path, cst.DEFAULT_MODULE_PATH);

      var proc_path = path.join(module_path, 'node_modules', canonic_module_name);
      var package_json_path = path.join(proc_path, 'package.json');

      // Start module
      StartModule(CLI, {
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
    require('shelljs').cp('-r', module_path, tmpdir);
  }
}
