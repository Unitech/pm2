
var Configuration = require('../../Configuration.js');
var cst = require('../../../constants.js');
var Common = require('../../Common');
var forEachLimit  = require('async/forEachLimit');

var path = require('path');
var fs = require('fs');
var os = require('os');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

var PM2_REGISTRY = process.env.PM2_REGISTRY

module.exports = {
  install,
  uninstall,
  start,
  publish,
  package
}

/**
 * Module management to manage tarball packages
 *
 * pm2 install http.tar.gz
 * pm2 uninstall http
 *
 * - the first and only folder in the tarball must be called module (tar zcvf http module/)
 * - a package.json must be present with attribute "name", "version" and "pm2" to declare apps to run
 */

function install(CLI, module_filepath, opts, cb) {
  Common.log(`Unpacking local tarball ${module_filepath}`)
  // Get module name by unpacking the module/package.json only and read the name attribute
  getModuleName(module_filepath, function(err, module_name) {
    if (err) return cb(err)

    Common.log(`Module name ${module_name} being installed`)

    var install_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);

    require('mkdirp').sync(install_path)

    var install_instance = spawn('tar', ['zxf', module_filepath, '-C', install_path, '--strip-components 1'], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    })

    install_instance.on('close', function(code) {
      if (code == 0)
        return runInstall(CLI, install_path, module_name, code, cb)
      return CLI.exitCli(1)
    });

    install_instance.on('error', function (err) {
      console.error(err.stack || err);
    });
  })
}

function runInstall(PM2, target_path, module_name, code, cb) {
  Common.log(`Module unpacked in ${target_path}`)

  var config_file = path.join(target_path, 'package.json')
  var conf

  try {
    conf = require(config_file)
    module_name = conf.name
  } catch(e) {
    Common.err(new Error('Cannot find package.json file with name attribute at least'));
  }

  var opts = {}
  // Force with the name in the package.json
  opts.started_as_module = true
  opts.cwd = target_path

  if ((conf.apps && conf.apps.length > 1) || (conf.pm2 && conf.pm2.length > 1))
    opts.name_prefix = module_name

  // Start apps under "apps" or "pm2" attribute
  PM2.start(conf, opts, function(err, data) {
    if (err) return cb(err)

    Configuration.setSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`, {
      source: 'tarball',
      installed_at: Date.now()
    })

    Common.log(`Module INSTALLED and STARTED`)
    return cb(null, 'Module installed & Starter')
  })
}

function start(PM2, module_name, cb) {
  var module_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);
  Common.printOut(cst.PREFIX_MSG_MOD + 'Starting TAR module ' + module_name);
  var package_json_path = path.join(module_path, 'package.json');

  try {
    var conf = require(package_json_path)
  } catch(e) {
    Common.printError(`Could not find package.json as ${package_json_path}`)
    return cb()
  }

  var opts = {};

  opts.started_as_module = true
  opts.cwd = module_path

  if ((conf.apps && conf.apps.length > 1) || (conf.pm2 && conf.pm2.length > 1))
    opts.name_prefix = module_name

  PM2.start(conf, opts, function(err, data) {
    if (err) {
      Common.printError(`Could not start ${module_name} ${module_path}`)
      return cb()
    }

    Common.printOut(`${cst.PREFIX_MSG_MOD} Module ${module_name} STARTED`)
    return cb();
  })
}

/**
 * Retrieve from module package.json the name of each application
 * delete process and delete folder
 */
function uninstall(PM2, module_name, cb) {
  var module_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);

  Common.log(`Removing ${module_name} from auto startup`)

  try {
    var pkg = require(path.join(module_path, 'package.json'))
  } catch(e) {
    Common.err('Could not retrieve module package.json');
    return cb(e)
  }

  var apps = pkg.apps || pkg.pm2

  /**
   * Some time a module can have multiple processes
   */
  forEachLimit(apps, 1, (app, next) => {
    var app_name

    if (apps.length > 1)
      app_name = `${module_name}:${app.name}`
    else
      app_name = app.name

    PM2._operate('deleteProcessId', app_name, () => next())
  }, () => {
    Configuration.unsetSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`)
    cb(null)
  })
}


/**
 * Uncompress only module/package.json and retrieve the "name" attribute in the package.json
 */
function getModuleName(module_filepath, cb) {
  var tmp_folder = path.join(os.tmpdir(), cst.MODULE_BASEFOLDER)

  var install_instance = spawn('tar', ['zxf', module_filepath, '-C', os.tmpdir(), `${cst.MODULE_BASEFOLDER}/package.json`], {
    stdio : 'inherit',
    env: process.env,
		shell : true
  })

  install_instance.on('close', function(code) {
    try {
      var pkg = JSON.parse(fs.readFileSync(path.join(tmp_folder, `package.json`)))
      return cb(null, pkg.name)
    } catch(e) {
      return cb(e)
    }
  });
}

function package(module_path, target_path, cb) {
  var base_folder = path.dirname(module_path)
  var module_folder_name = path.basename(module_path)
  var pkg = require(path.join(module_path, 'package.json'))
  var pkg_name = `${module_folder_name}-v${pkg.version.replace(/\./g, '-')}.tar.gz`
  var target_fullpath = path.join(target_path, pkg_name)

  var cmd = `tar zcf ${target_fullpath} -C ${base_folder} --transform 's,${module_folder_name},module,' ${module_folder_name}`

  var tar = exec(cmd, (err, sto, ste) => {
    if (err) {
      console.log(sto.toString().trim())
      console.log(ste.toString().trim())
    }
  })

  tar.on('close', function (code) {
    cb(code == 0 ? null : code, {
      package_name: pkg_name,
      path: target_fullpath
    })
  })
}

function publish(opts, cb) {
  try {
    var pkg = require(path.join(process.cwd(), 'package.json'))
  } catch(e) {
    Common.err(`${process.cwd()} module does not contain any package.json`)
    process.exit(1)
  }

  if (!pkg.name) throw new Error('Attribute name should be present')
  if (!pkg.version) throw new Error('Attribute version should be present')
  if (!pkg.pm2 && !pkg.apps) throw new Error('Attribute apps should be present')

  var current_path = process.cwd()
  var module_name = path.basename(current_path)
  var target_path = os.tmpdir()

  Common.log('Creating package')

  package(current_path, target_path, (err, res) => {
    if (err) {
      Common.err('Can\'t package, exiting')
      process.exit(1)
    }

    Common.log(`Package [${pkg.name}] created in path ${res.path}`)

    var data = {
      module_data: {
        file: res.path,
        content_type: 'content/gzip'
      },
      id: pkg.name,
      name: pkg.name,
      version: pkg.version
    };

    var uri = `${PM2_REGISTRY}/api/v1/modules`
    Common.log(`Sending Package to remote ${uri}`)

    require('needle')
      .post(uri, data, { multipart: true }, function(err, res, body) {
        if (err) {
          Common.err(err)
          process.exit(1)
        }
        if (res.statusCode !== 200) {
          Common.err(`${pkg.name}-${pkg.version}: ${res.body.msg}`)
          process.exit(1)
        }
        Common.log(`Module ${module_name} published under version ${pkg.version}`)
        process.exit(0)
      })
  })
}
