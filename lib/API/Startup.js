/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var debug  = require('debug')('pm2:cli:startup');
var chalk  = require('chalk');
var path   = require('path');
var fs     = require('fs');
var async  = require('async');
var exec   = require('child_process').exec;
var Common = require('../Common.js');
var cst    = require('../../constants.js');

module.exports = function(CLI) {

  /**
   * If command is launched without root right
   * Display helper
   */
  function isNotRoot(platform, opts, cb) {
    if (opts.user) {
      console.log(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
      console.log(chalk.grey('      sudo su -c "env PATH=$PATH:' + path.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + opts.user + ' --hp ' + process.env.HOME + '"'));
      return cb(new Error('You have to run this with elevated rights'));
    }
    return exec('whoami', function(err, stdout, stderr) {
      console.log(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
      console.log(chalk.grey('      sudo su -c "env PATH=$PATH:' + path.dirname(process.execPath) + ' pm2 startup ' + platform + ' -u ' + stdout.trim() + ' --hp ' + process.env.HOME + '"'));
      return cb(new Error('You have to run this with elevated rights'));
    });

  }

  /**
   * Startup script generation
   * @method startup
   * @param {string} platform type (centos|redhat|amazon|gentoo|systemd)
   */
  CLI.prototype.startup = function(platform, opts, cb) {
    var that = this;

    if (!cb) {
      cb = function(err, data) {
        if (err)
          return that.exitCli(cst.ERROR_EXIT);
        return that.exitCli(cst.SUCCESS_EXIT);
      }
    }

    if (process.getuid() != 0) {
      return isNotRoot(platform, opts, cb);
    }

    var destination  = '/etc/init.d/pm2-init.sh';
    var templateName = cst.UBUNTU_STARTUP_SCRIPT;
    var templatePath;
    var template;
    var cmd;
    var cmdAsUser;

    /**
     * 1# Determine startup script destination
     */
    if (platform == 'redhat') {
      platform = 'centos';
    }

    if (platform == 'systemd') {
      destination = '/etc/systemd/system/pm2.service';
    }

    if (platform == 'darwin') {
      destination = path.join(process.env.HOME, 'Library/LaunchAgents/io.keymetrics.PM2.plist');
      if (!fs.existsSync(path.dirname(destination))) {
        fs.mkdirSync(path.dirname(destination));
      }
    }

    if (platform == 'freebsd') {
      destination = '/etc/rc.d/pm2';
    }

    if (platform == 'gentoo') {
      destination = '/etc/init.d/pm2'
    }

    /**
     * 2# Resolve template file path
     */
    if (!!~['freebsd', 'systemd', 'centos', 'amazon', 'gentoo', 'darwin'].indexOf(platform))
      templateName = cst[platform.toUpperCase() + '_STARTUP_SCRIPT'];
    templatePath = path.join(cst.TEMPLATE_FOLDER, templateName);

    /**
     * 3# Read startup template file
     */
    debug('Getting startup template script %s', templatePath);
    template = fs.readFileSync(templatePath, {encoding: 'utf8'});

    var user = opts.user || 'root';

    /**
     * 4# Replace template variable value
     */
    template = template.replace(/%PM2_PATH%/g, process.mainModule.filename)
      .replace(/%NODE_PATH%/g, platform != 'darwin' ? path.dirname(process.execPath) : process.env.PATH)
      .replace(/%USER%/g, user);

    // Set the right user home path
    if (opts.hp)
      template = template.replace(/%HOME_PATH%/g, path.resolve(opts.hp, '.pm2'));
    else
      template = template.replace(/%HOME_PATH%/g, cst.PM2_ROOT_PATH);

    /**
     * 5# Writing generated startup script into the right folder
     */
    Common.printOut(cst.PREFIX_MSG + 'Writing startup script in ' + destination);

    try {
      fs.writeFileSync(destination, template);
    } catch (e) {
      console.error(cst.PREFIX_MSG_ERR + 'Failure when trying to write startup script');
      console.error(e.message || e);
      return cb(e);
    }

    /**
     * 6# Making startup script executable
     */
    Common.printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

    switch (platform) {
    case 'systemd':
      cmdAsUser = [
        'pm2 dump', //We need an empty dump so that the first resurrect works correctly
        'pm2 kill',
      ].join(' && ');
      cmd = [
        'systemctl daemon-reload',
        'systemctl enable pm2',
        'systemctl start pm2'
      ].join(' && ');
      break;
    case 'centos':
    case 'amazon':
      cmd = 'chmod +x ' + destination + '; chkconfig --add ' + path.basename(destination);
      fs.closeSync(fs.openSync('/var/lock/subsys/pm2-init.sh', 'w'));
      Common.printOut(cst.PREFIX_MSG + '/var/lock/subsys/pm2-init.sh lockfile has been added');
      break;
    case 'gentoo':
      cmd = 'chmod +x ' + destination + '; rc-update add ' + path.basename(destination) + ' default';
      break;
    case 'freebsd':
      cmd = 'chmod +x ' + destination;
      break;
      default :
      cmd = 'chmod +x ' + destination + ' && update-rc.d ' + path.basename(destination) + ' defaults';
      break;
    }

    if (platform == 'systemd') {
      cmd = 'su ' + user + ' -c "' + cmdAsUser + '" && su root -c "' + cmd + '"';
    } else if (platform == 'freebsd') {
      cmd = 'su root -c "' + cmd + '"';
    } else if (platform != 'darwin') {
      cmd = 'su -c "' + cmd + '"';
    } else {
      cmd = 'pm2 dump';
    }

    Common.printOut(cst.PREFIX_MSG + '-' + platform + '- Using the command:\n      %s', chalk.grey(cmd));

    exec(cmd, function(err, stdo, stde) {
      if (err) {
        Common.printError(err);
        Common.printError('----- Are you sure you use the right platform command line option ? centos / redhat, amazon, ubuntu, gentoo, systemd or darwin?');
        return cb(Common.retErr(err));
      }

      Common.printOut(stde.toString().replace(/[\r\n]$/, ''));
      Common.printOut(stdo.toString().replace(/[\r\n]$/, ''));
      Common.printOut(cst.PREFIX_MSG + 'Done.');
      console.log('');
      Common.printOut(cst.PREFIX_MSG + 'Now you can type' );
      console.log(chalk.bold.blue('$ pm2 save'));
      Common.printOut(cst.PREFIX_MSG + 'To save the current process list at reboot or via pm2 update');

      return cb(null, {
        destination  : destination,
        templatePath : templatePath
      });

    });
  };

  /**
   * Dump current processes managed by pm2 into DUMP_FILE_PATH file
   * @method dump
   * @param {} cb
   * @return
   */
  CLI.prototype.dump = function(cb) {
    var env_arr = [];
    var that = this;


    Common.printOut(cst.PREFIX_MSG + 'Saving current process list...');

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError('Error retrieving process list: ' + err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }

      /**
       * Description
       * @method fin
       * @param {} err
       * @return
       */
      function fin(err) {
        try {
          fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr, '', 2));
        } catch (e) {
          console.error(e.stack || e);
          Common.printOut(cst.PREFIX_MSG_ERR + 'Failed to save dump file in %s', cst.DUMP_FILE_PATH);
          return that.exitCli(cst.ERROR_EXIT);
        }
        if (cb) return cb(null, {success:true});

        Common.printOut(cst.PREFIX_MSG + 'Successfully saved in %s', cst.DUMP_FILE_PATH);
        return that.exitCli(cst.SUCCESS_EXIT);
      }

      (function ex(apps) {
        if (!apps[0]) return fin(null);
        delete apps[0].pm2_env.instances;
        delete apps[0].pm2_env.pm_id;
        if (!apps[0].pm2_env.pmx_module)
          env_arr.push(apps[0].pm2_env);
        apps.shift();
        return ex(apps);
      })(list);
    });
  };

  /**
   * Resurrect processes
   * @method resurrect
   * @param {} cb
   * @return
   */
  CLI.prototype.resurrect = function(cb) {
    var apps = {};
    var that = this;

    Common.printOut(cst.PREFIX_MSG + 'Restoring processes located in %s', cst.DUMP_FILE_PATH);

    try {
      apps = fs.readFileSync(cst.DUMP_FILE_PATH);
    } catch(e) {
      Common.printError(cst.PREFIX_MSG_ERR + 'No processes saved; DUMP file doesn\'t exist');
      if (cb) return cb(Common.retErr(e));
      else return that.exitCli(cst.ERROR_EXIT);
    }

    var processes = Common.parseConfig(apps, 'none');

    async.eachLimit(processes, cst.CONCURRENT_ACTIONS, function(app, next) {
      that.Client.executeRemote('prepare', app, function(err, dt) {
        if (err)
          Common.printError(err);
        else
          Common.printOut(cst.PREFIX_MSG + 'Process %s restored', app.pm_exec_path);
        next();
      });
    }, function(err) {
      return cb ? cb(null, apps) : that.speedList();
    });
  };

}
