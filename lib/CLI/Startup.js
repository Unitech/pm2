'use strict';

var chalk = require('chalk');
var Common = require('../Common');
var cst = require('../../constants');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp')

var unixHelper = require('./Startup/UnixHelper.js')

var PREFIX_MSG = cst.PREFIX_MSG;
var PREFIX_MSG_ERR = cst.PREFIX_MSG_ERR;

function exitCli(err) {
  Common.exitCli(err ? cst.ERROR_EXIT : cst.SUCCESS_EXIT);
}

function createDirAs(dir, user, callback) {
  fs.stat(dir, checkStat);

  function checkStat(err) {
    if (!err) {
      callback();
    }
    else if (err.code === 'ENOENT') {
      mkdirp(dir, afterMkdir);
    }
    else {
      Common.printError(PREFIX_MSG_ERR + 'Can\'t get stat for ' + dir);
      callback(err);
    }
  }

  function afterMkdir(err) {
    if (err) {
      Common.printError(PREFIX_MSG_ERR + 'Error creating folder ' + dir);
      return callback(err);
    }

    fs.chown(dir, user, user, afterChown);
  }

  function afterChown(err) {
    if (err) {
      Common.printError(PREFIX_MSG_ERR + 'Error changing owner for ' + dir);
    }

    callback(err);
  }
}

var StartupModule = {};

StartupModule.startup = function startup(platform, opts, callback) {
  callback = callback || exitCli;

  if (process.getuid() !== 0) {
    return this._warnUnprivileged(platform, opts.user, opts.hp, wrapIfError);
  }

  this._normalize(platform, opts.user, opts.hp, proceed);

  function proceed(err, platform, user, home) {
    if (err) {
      return wrapIfError(err)
    }

    StartupModule._generate(platform, user, home, wrapIfError);
  }

  function wrapIfError(err, res) {
    if (err) {
      Common.printError(err);
      return callback({msg: err.message});
    }

    callback(null, res);
  }
};

/**
 * Warn the user that he has to run this command as root
 * Fetch missing informations (current username, home directory etc.)
 * @param {String} platform
 * @param {String} user
 * @param {String} home
 * @param {Function} callback
 */
StartupModule._warnUnprivileged = function warnUnprivileged(platform, user, home, callback) {
  home = home || process.env.HOME;

  if (user && home) {
    print(null, user, home);
  }
  else if (!user) {
    exec('whoami', getHome);
  }
  else {
    getHome(null, user);
  }

  function getHome(err, user) {
    if (err) {
      print(err);
    }
    else if (home) {
      print(null, user, home);
    }
    else {
      StartupModule._detectHomeDir(user, function afterResolve(err, home) {
        print(err, user, home);
      });
    }
  }

  function print(err, user, home) {
    if (err) {
      return callback(err);
    }

    var execPathDir = path.dirname(process.execPath);

    Common.printOut(PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
    Common.printOut(chalk.grey('      sudo su root -c "env PATH=$PATH:' + execPathDir + ' pm2 startup ' + platform + ' -u ' + user.trim() + ' --hp ' + home + '"'));

    return callback(new Error('You have to run this with elevated rights'));
  }
}

/**
 * Normalize input data, fix platform, get home directory if not available
 * @param {String} platform
 * @param {String} user - -u argument
 * @param {String} homepath - comes from --hp argument
 * @param {Function} callback
 */
StartupModule._normalize = function normalize(platform, user, homepath, callback) {
  if (platform === 'redhat') {
    platform = 'centos';
  }

  if (!user) {
    user = 'root';
  }

  if (homepath) {
    return callback(null, platform, user, homepath);
  }

  StartupModule._detectHomeDir(user, done);

  function done(err, homepath) {
    if (err) {
      return callback(err);
    }

    callback(null, platform, user, homepath);
  }
}

/**
 * Creates the startup file by replacing tokens in the template
 * @param {String} platform
 * @param {String} user
 * @param {String} home
 * @param {Function} callback
 */
StartupModule._generate = function generate(platform, user, home, callback) {
  var helper;
  if (~platform.indexOf('win')) {
    helper = winHelper(platform, user, home);
  } else {
    helper = unixHelper(platform, user, home);
  }

  var relPath = helper.getSourcePath();
  var scriptPath = path.resolve(__dirname, '..', relPath);

  fs.readFile(scriptPath, { encoding: 'utf8' }, replaceTokens);

  function replaceTokens(err, data) {
    if (err) {
      Common.printError(PREFIX_MSG_ERR + 'Error reading script template ' + scriptPath);
      return callback(err);
    }

    var context = helper.getScriptContext();

    data = data.replace(/%PM2_PATH%/g, context.pm2Path)
      .replace(/%NODE_PATH%/g, context.nodePath)
      .replace(/%USER%/g, context.user)
      .replace(/%HOME_PATH%/g, context.home);

    var dest = helper.getDestPath()

    createDirectory(dest, function(err) {
      if(err)
        return callback(err);

      writeAndSchedule(data, dest);
    });
  }
  
  function createDirectory(scriptPath) {
    var scriptDir = path.dirname(scriptPath);

    return createDirAs(scriptDir, user, function afterCreate(err) {
      if (err) {
        callback(err);
      }
      else {
        callback(null, scriptPath);
      }
    });
  }

  function writeAndSchedule(data, scriptPath) {
    Common.printOut(PREFIX_MSG + 'Generating init script in ' + scriptPath);

    fs.writeFile(scriptPath, data, afterWrite);

    function afterWrite(err) {
      if (err) {
        Common.printError(PREFIX_MSG_ERR + 'Error writing init script at ' + scriptPath);
        return callback(err);
      }

      Common.printOut(PREFIX_MSG + 'Making script booting at startup...');

      execute(helper.getScheduleCommand(scriptPath));
    }
  }

  function execute(cmd) {
    Common.printOut(PREFIX_MSG + '-' + platform + '- Using the command:\n      %s', chalk.grey(cmd));

    exec(cmd, handleResult);
  }

  function handleResult(err, stdout) {
    if (err) {
      Common.printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo, systemd or darwin?');
      return callback(err);
    }

    Common.printOut(stdout.toString().replace(/[\r\n]$/, ''));
    Common.printOut(PREFIX_MSG + 'Done.');
    return callback(null, { success: true });
  }
}

/**
 * Get home directory, executes os.homedir() from the wanted user
 * @todo windows behavior
 * @param {String} user 
 * @param {Function} callback 
 */
StartupModule._detectHomeDir = function detectHomeDir(user, callback) {
  var command = ''

  //tests are usually not launched with root
  if(process.getuid === 0) {
    command = 'su ' + user + ' -c '
  }

  command += process.argv[0] + ' -e "console.log(require(\'os\').homedir());"';

  exec(command, handleResult);

  function handleResult(err, stdout) {
    if (err || !stdout) {
      Common.printError(PREFIX_MSG_ERR + 'Can\'t detect user home directory:');
      if (!err) {
        err = new Error('Missing home directory');
      }

      return callback(err);
    }

    callback(null, stdout.trim());
  }
}

module.exports = StartupModule;
