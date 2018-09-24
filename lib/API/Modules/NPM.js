var path          = require('path');
var fs            = require('fs');
var os            = require('os');
var parallel      = require('async/parallel');
var eachLimit     = require('async/eachLimit');
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

var MODULE_CONF_PREFIX = 'module-db-v2';

module.exports = {
  install,
  uninstall
}

function install(CLI, module_name, opts, cb) {
  Common.printOut(cst.PREFIX_MSG_MOD + 'Calling ' + chalk.bold.red('[NPM]') + ' to install ' + module_name + ' ...');

  var canonic_module_name = Utility.getCanonicModuleName(module_name);
  var install_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);

  require('mkdirp')(install_path, function() {
    process.chdir(os.homedir());

    var install_instance = spawn(cst.IS_WINDOWS ? 'npm.cmd' : 'npm', ['install', module_name, '--loglevel=error', '--prefix', install_path ], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    });

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

    Configuration.set(MODULE_CONF_PREFIX + ':' + canonic_module_name, {
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
          Common.printOut(cst.PREFIX_MSG_MOD + 'Edit configuration via: `pm2 conf`');
          return cb(null, dt);
        });
      });
    });
  }
}

function uninstall(CLI, module_name, cb) {
  var proc_path = p.join(cst.DEFAULT_MODULE_PATH, module_name);

  Configuration.unsetSync(cst.MODULE_CONF_PREFIX + ':' + module_name);

  CLI.deleteModule(module_name, function(err, data) {
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
