
var Configuration = require('../../Configuration.js');
var cst = require('../../../constants.js');
var Common = require('../../Common');
var forEachLimit  = require('async/forEachLimit');
const sexec = require('../../tools/sexec.js');
const deleteFolderRecursive = require('../../tools/deleteFolderRecursive.js');

var path = require('path');
var fs = require('fs');
var os = require('os');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = {
  install,
  uninstall,
  start,
  publish,
  packager
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

function install(PM2, module_filepath, opts, cb) {
  // Remote file retrieval
  if (module_filepath.includes('http') === true) {
    var target_file = module_filepath.split('/').pop()
    var target_filepath = path.join(os.tmpdir(), target_file)

    opts.install_url = module_filepath

    return retrieveRemote(module_filepath, target_filepath, (err) => {
      if (err) {
        Common.errMod(err)
        process.exit(1)
      }
      installLocal(PM2, target_filepath, opts, cb)
    })
  }

  // Local install
  installLocal(PM2, module_filepath, opts, cb)
}

function retrieveRemote(url, dest, cb) {
  Common.logMod(`Retrieving remote package ${url}...`)

  var wget = spawn('wget', [url, '-O', dest, '-q'], {
    stdio : 'inherit',
    env: process.env,
    windowsHide: true,
		shell : true
  })

  wget.on('error', (err) => {
    console.error(err.stack || err)
  })

  wget.on('close', (code) => {
    if (code !== 0)
      return cb(new Error('Could not download'))
    return cb(null)
  })
}

function installLocal(PM2, module_filepath, opts, cb) {
  Common.logMod(`Installing package ${module_filepath}`)

  // Get module name by unpacking the module/package.json only and read the name attribute
  getModuleName(module_filepath, function(err, module_name) {
    if (err) return cb(err)

    Common.logMod(`Module name is ${module_name}`)

    Common.logMod(`Depackaging module...`)

    var install_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);

    require('mkdirp').sync(install_path)

    var install_instance = spawn('tar', ['zxf', module_filepath, '-C', install_path, '--strip-components 1'], {
      stdio : 'inherit',
      env: process.env,
		  shell : true
    })

    install_instance.on('close', function(code) {
      Common.logMod(`Module depackaged in ${install_path}`)
      if (code == 0)
        return runInstall(PM2, install_path, module_name, opts, cb)
      return PM2.exitCli(1)
    });

    install_instance.on('error', function (err) {
      console.error(err.stack || err);
    });
  })
}

function deleteModulePath(module_name) {
  var sanitized = module_name.replace(/\./g, '')
  deleteFolderRecursive(path.join(cst.DEFAULT_MODULE_PATH, module_name));
}

function runInstall(PM2, target_path, module_name, opts, cb) {
  var config_file = path.join(target_path, 'package.json')
  var conf

  try {
    conf = require(config_file)
    module_name = conf.name
  } catch(e) {
    Common.errMod(new Error('Cannot find package.json file with name attribute at least'));
  }

  // Force with the name in the package.json
  opts.started_as_module = true
  opts.cwd = target_path

  if (needPrefix(conf))
    opts.name_prefix = module_name

  if (opts.install) {
    Common.logMod(`Running YARN install...`)

    sexec(`cd ${target_path} ; yarn install`, {silent: false}, function(code) {
      // Start apps under "apps" or "pm2" attribute
      Common.logMod(`Starting ${target_path}`)
      PM2.start(conf, opts, function(err, data) {
        if (err) return cb(err)

        Configuration.setSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`, {
          source: 'tarball',
          install_url: opts.install_url,
          installed_at: Date.now()
        })

        Common.logMod(`Module INSTALLED and STARTED`)
        return cb(null, 'Module installed & Started')
      })
    })
  }
  else {
    PM2.start(conf, opts, function(err, data) {
      if (err) return cb(err)

      Configuration.setSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`, {
        source: 'tarball',
        install_url: opts.install_url,
        installed_at: Date.now()
      })

      Common.logMod(`Module INSTALLED and STARTED`)
      return cb(null, 'Module installed & Started')
    })
  }
}

function start(PM2, module_name, cb) {
  var module_path = path.join(cst.DEFAULT_MODULE_PATH, module_name);
  Common.printOut(cst.PREFIX_MSG_MOD + 'Starting TAR module ' + module_name);
  var package_json_path = path.join(module_path, 'package.json');
  var module_conf = Configuration.getSync(`${cst.MODULE_CONF_PREFIX_TAR}:${module_name}`)

  try {
    var conf = require(package_json_path)
  } catch(e) {
    Common.printError(`Could not find package.json as ${package_json_path}`)
    return cb()
  }

  var opts = {};

  opts.started_as_module = true
  opts.cwd = module_path

  if (module_conf.install_url)
    opts.install_url = module_conf.install_url

  if (needPrefix(conf))
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

  Common.logMod(`Removing ${module_name} from auto startup`)

  try {
    var pkg = require(path.join(module_path, 'package.json'))
  } catch(e) {
    Common.errMod('Could not retrieve module package.json');
    return cb(e)
  }

  var apps = pkg.apps || pkg.pm2
  apps = [].concat(apps);

  /**
   * Some time a module can have multiple processes
   */
  forEachLimit(apps, 1, (app, next) => {
    var app_name

    if (!app.name) {
      Common.renderApplicationName(app)
    }

    if (apps.length > 1)
      app_name = `${module_name}:${app.name}`
    else if (apps.length == 1 && pkg.name != apps[0].name)
      app_name = `${module_name}:${app.name}`
    else
      app_name = app.name

    PM2._operate('deleteProcessId', app_name, () => {
      deleteModulePath(module_name)
      next()
    })
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

function packager(module_path, target_path, cb) {
  var base_folder = path.dirname(module_path)
  var module_folder_name = path.basename(module_path)
  var pkg = require(path.join(module_path, 'package.json'))
  var pkg_name = `${module_folder_name}-v${pkg.version.replace(/\./g, '-')}.tar.gz`
  var target_fullpath = path.join(target_path, pkg_name)

  var cmd = `tar zcf ${target_fullpath} -C ${base_folder} --transform 's,${module_folder_name},module,' ${module_folder_name}`

  Common.logMod(`Gziping ${module_path} to ${target_fullpath}`)

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

function publish(PM2, folder, cb) {
  var target_folder = folder ? path.resolve(folder) : process.cwd()

  try {
    var pkg = JSON.parse(fs.readFileSync(path.join(target_folder, 'package.json')).toString())
  } catch(e) {
    Common.errMod(`${process.cwd()} module does not contain any package.json`)
    process.exit(1)
  }

  if (!pkg.name) throw new Error('Attribute name should be present')
  if (!pkg.version) throw new Error('Attribute version should be present')
  if (!pkg.pm2 && !pkg.apps) throw new Error('Attribute apps should be present')

  var current_path = target_folder
  var module_name = path.basename(current_path)
  var target_path = os.tmpdir()

  Common.logMod(`Starting publishing procedure for ${module_name}@${pkg.version}`)

  packager(current_path, target_path, (err, res) => {
    if (err) {
      Common.errMod('Can\'t package, exiting')
      process.exit(1)
    }

    Common.logMod(`Package [${pkg.name}] created in path ${res.path}`)

    var data = {
      module_data: {
        file: res.path,
        content_type: 'content/gzip'
      },
      id: pkg.name,
      name: pkg.name,
      version: pkg.version
    };

    var uri = `${PM2.pm2_configuration.registry}/api/v1/modules`
    Common.logMod(`Sending Package to remote ${pkg.name} ${uri}`)

    require('needle')
      .post(uri, data, { multipart: true }, function(err, res, body) {
        if (err) {
          Common.errMod(err)
          process.exit(1)
        }
        if (res.statusCode !== 200) {
          Common.errMod(`${pkg.name}-${pkg.version}: ${res.body.msg}`)
          process.exit(1)
        }
        Common.logMod(`Module ${module_name} published under version ${pkg.version}`)
        process.exit(0)
      })
  })
}

function needPrefix(conf) {
  if ((conf.apps && conf.apps.length > 1) ||
      (conf.pm2 && conf.pm2.length > 1) ||
      (conf.apps.length == 1 && conf.name != conf.apps[0].name))
    return true
  return false
}
