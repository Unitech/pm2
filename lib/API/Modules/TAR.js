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
var StartModule = require('./StartModule.js')

module.exports = {
  install
}

function guessModuleName(filepath) {
  return filepath.replace('.tar.gz', '').replace(path.extname(filepath), '')
}

function getModuleName(module_filepath, cb) {
  var install_instance = spawn('tar', ['zxf', module_filepath, '-C', os.tmpdir(), `${cst.MODULE_BASEFOLDER}/package.json`], {
    stdio : 'inherit',
    env: process.env,
		shell : true
  })

  install_instance.on('close', function(code) {
    try {
      var pkg = require(path.join(os.tmpdir(), `${cst.MODULE_BASEFOLDER}/package.json`))
      return cb(null, pkg.name)
    } catch(e) {
      return cb(e)
    }
  });
}

function install(CLI, module_filepath, opts, cb) {
  Common.printOut(`${cst.PREFIX_MSG_MOD} Unpacking local tarball ${module_filepath}`)

  // Get module name by unpacking the module/package.json and read the name attribute
  getModuleName(module_filepath, function(err, module_name) {
    if (err) return cb(err)

    Common.printOut(`${cst.PREFIX_MSG_MOD} Module name ${module_name} being installed`)

    var install_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);

    require('mkdirp').sync(install_path)

    var install_instance = spawn('tar', ['zxf', module_filepath, '-C', install_path, '--strip-components 1'], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    })

    install_instance.on('close', function(code) {
      finalize(CLI, install_path, module_name, opts, code, cb)
    });

    install_instance.on('error', function (err) {
      console.error(err.stack || err);
    });
  })
}

function finalize(PM2, target_path, module_name, opts, code, cb) {
  Common.printOut(`${cst.PREFIX_MSG_MOD} Module unpacked in ${target_path}`)

  var config_file = path.join(target_path, 'package.json')
  var conf

  try {
    conf = require(config_file)
    module_name = conf.name
  } catch(e) {
    Common.printError(new Error('Cannot find package.json file with name attribute at least'));
  }

  // Force with the name in the package.json
  opts.started_as_module = true
  opts.cwd = target_path

  PM2.start(conf, opts, function(err, data) {
    if (err) return cb(err)

    Configuration.setSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`, {
      source: 'tarball',
      installed_at: Date.now()
    })

    Common.printOut(`${cst.PREFIX_MSG_MOD} Module INSTALLED and STARTED`)
    return cb(null, 'Module installed & Starter')
  })

}
