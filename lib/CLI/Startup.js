'use strict';

var chalk = require('chalk');
var Common = require('../Common');
var cst = require('../../constants');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

var PREFIX_MSG = cst.PREFIX_MSG;
var PREFIX_MSG_ERR = cst.PREFIX_MSG_ERR;
var SUPPORTED_PLATFORMS = ['freebsd', 'systemd', 'centos', 'amazon', 'gentoo', 'darwin'];

var StartupModule = {};

StartupModule.startup = function startup(platform, opts, callback) {
  callback = callback || exitCli;

  if (process.getuid() !== 0) {
    return warnUnprivileged(platform, opts.user, opts.hp, callback);
  }

  normalize(platform, opts.user, opts.hp, proceed);

  function proceed(err, platform, user, home) {
    if (err) {
      return callback();
    }

    generate(platform, user, home, wrapIfError);
  }

  function wrapIfError(err, res) {
    if (err) {
      callback({msg: err});
    }
    else {
      callback(null, res);
    }
  }
};

function exitCli(err) {
  if (err) {
    Common.exitCli(cst.ERROR_EXIT);
  }
  else {
    Common.exitCli(cst.SUCCESS_EXIT);
  }
}

function warnUnprivileged(platform, user, home, callback) {
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
      detectHomeDir(user, function afterResolve(err, home) {
        print(err, user, home);
      });
    }
  }

  function print(err, user, home) {
    if (err) {
      Common.printError(err);
      return callback({ msg: 'Error running `whoami`' });
    }

    var execPathDir = path.dirname(process.execPath);

    Common.printOut(PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
    Common.printOut(chalk.grey('      sudo su root -c "env PATH=$PATH:' + execPathDir + ' pm2 startup ' + platform + ' -u ' + user.trim() + ' --hp ' + home + '"'));

    return callback({ msg: 'You have to run this with elevated rights' });
  }
}

function normalize(platform, user, homepath, callback) {
  if (platform === 'redhat') {
    platform = 'centos';
  }

  if (!user) {
    user = 'root';
  }

  if (homepath) {
    return callback(null, platform, user, homepath);
  }

  detectHomeDir(user, done);

  function done(err, homepath) {
    if (err) {
      callback(err);
    }
    else {
      callback(null, platform, user, homepath);
    }
  }
}

function generate(platform, user, home, callback) {
  var helper;
  if (platform === 'win32') {
    helper = winHelper(platform);
  }
  else {
    helper = unixHelper(platform, user, home);
  }

  var relPath = helper.getSourcePath();
  var scriptPath = path.resolve(__dirname, '..', relPath);

  fs.readFile(scriptPath, { encoding: 'utf8' }, replaceTokens);

  function replaceTokens(err, data) {
    if (err) {
      printError(err, 'Error reading script template ' + scriptPath);
      return callback(err);
    }

    var context = helper.getScriptContext();

    data = data.replace(/%PM2_PATH%/g, context.pm2Path)
      .replace(/%NODE_PATH%/g, context.nodePath)
      .replace(/%USER%/g, context.user)
      .replace(/%HOME_PATH%/g, context.home);

    helper.getDestPath(function(err, dest) {
      if (err) {
        return callback(err);
      }

      writeAndSchedule(data, dest);
    });
  }

  function writeAndSchedule(data, scriptPath) {
    Common.printOut(PREFIX_MSG + 'Generating init script in ' + scriptPath);

    fs.writeFile(scriptPath, data, afterWrite);

    function afterWrite(err) {
      if (err) {
        printError(err, 'Error writing init script at ' + scriptPath);
        return callback(err);
      }

      Common.printOut(PREFIX_MSG + 'Making script booting at startup...');

      helper.getScheduleCommand(scriptPath, after);
    }

    function after(err, cmd) {
      if (err) {
        printError(err, 'Error writing init script at ' + scriptPath);
        return callback(err);
      }

      execute(cmd);
    }
  }

  function execute(cmd) {
    Common.printOut(PREFIX_MSG + '-' + platform + '- Using the command:\n      %s', chalk.grey(cmd));

    exec(cmd, handleResult);
  }

  function handleResult(err, stdout) {
    if (err) {
      Common.printError(err);
      Common.printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo, systemd or darwin?');
      return callback(err);
    }

    Common.printOut(stdout.toString().replace(/[\r\n]$/, ''));
    Common.printOut(PREFIX_MSG + 'Done.');
    return callback(null, { success: true });
  }
}

function detectHomeDir(user, callback) {
  var command = 'su ' + user + ' -c "' + process.argv[0] + ' -e \\"console.log(require(\'os\').homedir());\\""';

  exec(command, handleResult);

  function handleResult(err, stdout) {
    if (err || !stdout) {
      Common.printError(PREFIX_MSG_ERR + 'Can\'t detect user home directory:');
      if (!err) {
        err = new Error('Missing home directory');
      }

      callback(err);
    }
    else {
      callback(null, stdout.trim());
    }
  }
}

function unixHelper(platform, user, home) {
  if (platform === 'redhat') {
    platform = 'centos';
  }

  function getScriptContext() {
    var ctx = {
      pm2Path: process.mainModule.filename,
      home: path.join(home, '.pm2'),
      user: user
    };

    if (platform === 'darwin') {
      ctx.nodePath = process.env.PATH;
    }
    else {
      ctx.nodePath = path.dirname(process.execPath);
    }

    return ctx;
  }

  function getSourcePath() {
    if (~SUPPORTED_PLATFORMS.indexOf(platform)) {
      return cst[platform.toUpperCase() + '_STARTUP_SCRIPT'];
    }
    else {
      return cst.UBUNTU_STARTUP_SCRIPT;
    }
  }

  function getDestPath(callback) {
    var scriptPath;

    if (platform === 'darwin') {
      scriptPath = 'Library/LaunchAgents/io.keymetrics.PM2.plist';

      if (user === 'root') {
        scriptPath = '/' + scriptPath;
      }
      else {
        scriptPath = path.join(home, scriptPath);
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
    }
    else if (platform === 'freebsd') {
      scriptPath = '/etc/rc.d/pm2';
    }
    else if (platform === 'systemd') {
      scriptPath = '/etc/systemd/system/pm2.service';
    }
    else {
      scriptPath = '/etc/init.d/pm2-init.sh';
    }

    return callback(null, scriptPath);
  }

  function getScheduleCommand(scriptPath, callback) {
    var cmdAsUser;
    var cmd;
    var scriptFileBase = path.basename(scriptPath);

    if (isRedhat()) {
      cmd = 'chmod +x ' + scriptPath + '; chkconfig --add ' + scriptFileBase;
    }
    else if (platform === 'systemd') {
      //We need an empty dump so that the first resurrect works correctly
      cmdAsUser = 'pm2 dump && pm2 kill';
      cmd = 'systemctl daemon-reload && systemctl enable pm2 && systemctl start pm2';
    }
    else if (platform === 'gentoo') {
      cmd = 'chmod +x ' + scriptPath + '; rc-update add ' + scriptFileBase + ' default';
    }
    else if (platform === 'freebsd') {
      cmd = 'chmod +x ' + scriptPath;
    }
    else {
      cmd = 'chmod +x ' + scriptPath + ' && update-rc.d ' + scriptFileBase + ' defaults';
    }

    if (platform === 'systemd') {
      cmd = 'su ' + user + ' -c "' + cmdAsUser + '" && su root -c "' + cmd + '"';
    }
    else if (platform === 'freebsd') {
      cmd = 'su root -c "' + cmd + '"';
    }
    else if (platform !== 'darwin') {
      cmd = 'su -c "' + cmd + '"';
    }
    else {
      cmd = 'pm2 dump';
    }

    if (isRedhat()) {
      touch('/var/lock/subsys/pm2-init.sh', function handleResult(err) {
        if (err) {
          callback(err);
        }
        else {
          callback(null, cmd);
        }
      });
    }
    else {
      callback(null, cmd);
    }
  }

  function isRedhat() {
    return platform === 'amazon' || platform === 'centos';
  }

  return {
    getScheduleCommand: getScheduleCommand,
    getScriptContext: getScriptContext,
    getSourcePath: getSourcePath,
    getDestPath: getDestPath
  };
}

function createDirAs(dir, user, callback) {
  fs.stat(dir, checkStat);

  function checkStat(err) {
    if (!err) {
      callback();
    }
    else if (err.code === 'ENOENT') {
      fs.mkdir(dir, afterMkdir);
    }
    else {
      printError(err, 'Can\'t get stat for ' + dir);
      callback(err);
    }
  }

  function afterMkdir(err) {
    if (err) {
      printError(err, 'Error creating folder ' + dir);
      return callback(err);
    }

    fs.chown(dir, user, user, afterChown);
  }

  function afterChown(err) {
    if (err) {
      printError(err, 'Error changing owner for ' + dir);
    }

    callback(err);
  }
}

function printError(err, msg) {
  if (msg) {
    Common.printOut(PREFIX_MSG_ERR + msg);
  }
  Common.printError(err);
}

function touch(file, callback) {
  fs.open(file, 'w', afterOpen);

  function afterOpen(err, fd) {
    if (err) {
      printError(err, 'Error opening file' + file);
      return callback(err);
    }

    fs.close(fd, afterClose);
  }

  function afterClose(err) {
    if (err) {
      printError(err, 'Error closing file' + file);
    }

    callback(err);
  }
}

function winHelper() {
  return {
    getSourcePath: function() {
      throw new Error('Not implemented');
    },
    getDestPath: function() {
      throw 'Not implemented';
    }
  };
}

module.exports = StartupModule;
