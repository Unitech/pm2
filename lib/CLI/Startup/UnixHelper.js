var path = require('path')
var fs = require('fs')
var cst = require('../../../constants.js');
var Common = require('../../Common');

var SUPPORTED_PLATFORMS = ['freebsd', 'systemd', 'centos', 'amazon', 'gentoo', 'darwin'];

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

  function getDestPath() {
    var scriptPath;

    switch (platform) {
      case 'darwin':
        scriptPath = 'Library/LaunchAgents/io.keymetrics.PM2.plist';

        if (user === 'root') {
          scriptPath = '/' + scriptPath;
        } else {
          scriptPath = path.join(home, scriptPath);
        }
        
        break;
      case 'freebsd':
        scriptPath = '/etc/rc.d/pm2';
        break;
      case 'systemd':
        scriptPath = '/etc/systemd/system/pm2.service';
        break;
      default:
        scriptPath = '/etc/init.d/pm2-init.sh';
    }

    return scriptPath;
  }

  function getScheduleCommand(scriptPath) {
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
      var lock = '/var/lock/subsys/pm2-init.sh'

      try {
        fs.writeFileSync(lock, '');
      } catch(err) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Writing lock file failed (' + lock + ')', err);
      }
    }

    return cmd
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

module.exports = unixHelper 
