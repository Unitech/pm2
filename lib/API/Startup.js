/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var chalk        = require('chalk');
var path         = require('path');
var fs           = require('fs');
var forEachLimit = require('async/forEachLimit');
var eachLimit    = require('async/eachLimit');
var exec         = require('child_process').exec;
var Common       = require('../Common.js');
var cst          = require('../../constants.js');

module.exports = function(CLI) {
  /**
   * If command is launched without root right
   * Display helper
   */
  function isNotRoot(platform, opts, cb) {
    if (opts.user) {
      Common.printOut(cst.PREFIX_MSG + 'To setup the Startup Script, copy/paste the following command:');
      console.log('sudo env PATH=$PATH:' + path.dirname(process.execPath) + ' pm2 ' + opts.args[1].name() + ' ' + platform + ' -u ' + opts.user + ' --hp ' + process.env.HOME);
      return cb(new Error('You have to run this with elevated rights'));
    }
    return exec('whoami', function(err, stdout, stderr) {
      Common.printOut(cst.PREFIX_MSG + 'To setup the Startup Script, copy/paste the following command:');
      console.log('sudo env PATH=$PATH:' + path.dirname(process.execPath) + ' ' + require.main.filename + ' ' + opts.args[1].name() + ' ' + platform + ' -u ' + stdout.trim() + ' --hp ' + process.env.HOME);
      return cb(new Error('You have to run this with elevated rights'));
    });
  }

  /**
   * Detect running init system
   */
  function detectInitSystem() {
    var hash_map = {
      'systemctl'  : 'systemd',
      'update-rc.d': 'upstart',
      'chkconfig'  : 'systemv',
      'rc-update'  : 'openrc',
      'launchctl'  : 'launchd',
      'sysrc'      : 'rcd',
      'rcctl'      : 'rcd-openbsd',
    };
    var init_systems = Object.keys(hash_map);

    for (var i = 0; i < init_systems.length; i++) {
      if (require('shelljs').which(init_systems[i]) != null) {
        break;
      }
    }

    if (i >= init_systems.length) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Init system not found');
      return null;
    }
    Common.printOut(cst.PREFIX_MSG + 'Init System found: ' + chalk.bold(hash_map[init_systems[i]]));
    return hash_map[init_systems[i]];
  }

  CLI.prototype.uninstallStartup = function(platform, opts, cb) {
    var commands;
    var that = this;
    var actual_platform = detectInitSystem();
    var user = opts.user || process.env.USER;
    var service_name = (opts.serviceName || 'pm2-' + user);
    var openrc_service_name = 'pm2';
    var launchd_service_name = (opts.serviceName || 'pm2.' + user);

    if (!platform)
      platform = actual_platform;
    else if (actual_platform && actual_platform !== platform) {
      Common.printOut('-----------------------------------------------------------')
      Common.printOut(' PM2 detected ' + actual_platform + ' but you precised ' + platform)
      Common.printOut(' Please verify that your choice is indeed your init system')
      Common.printOut(' If you arent sure, just run : pm2 startup')
      Common.printOut('-----------------------------------------------------------')
    }
    if (platform === null)
      throw new Error('Init system not found')

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

    if (fs.existsSync('/etc/init.d/pm2-init.sh')) {
      platform = 'oldsystem';
    }

    switch(platform) {
    case 'systemd':
      commands = [
        'systemctl stop ' + service_name,
        'systemctl disable ' + service_name,
        'rm /etc/systemd/system/' + service_name + '.service'
      ];
      break;
    case 'systemv':
      commands = [
        'chkconfig ' + service_name + ' off',
        'rm /etc/init.d/' + service_name
      ];
      break;
    case 'oldsystem':
      Common.printOut(cst.PREFIX_MSG + 'Disabling and deleting old startup system');
      commands = [
        'update-rc.d pm2-init.sh disable',
        'update-rc.d -f pm2-init.sh remove',
        'rm /etc/init.d/pm2-init.sh'
      ];
      break;
    case 'openrc':
      service_name = openrc_service_name;
      commands = [
        '/etc/init.d/' + service_name + ' stop',
        'rc-update delete ' + service_name + ' default',
        'rm /etc/init.d/' + service_name
      ];
      break;
    case 'upstart':
      commands = [
        'update-rc.d ' + service_name + ' disable',
        'update-rc.d -f ' + service_name + ' remove',
        'rm /etc/init.d/' + service_name
      ];
      break;
    case 'launchd':
      var destination = path.join(process.env.HOME, 'Library/LaunchAgents/' + launchd_service_name + '.plist');
      commands = [
        'launchctl remove ' + launchd_service_name,
        'rm ' + destination
      ];
      break;
    case 'rcd':
      service_name = (opts.serviceName || 'pm2_' + user);
      commands = [
        '/usr/local/etc/rc.d/' + service_name + ' stop',
        'sysrc -x ' + service_name  + '_enable',
        'rm /usr/local/etc/rc.d/' + service_name
      ];
      break;
    case 'rcd-openbsd':
      service_name = (opts.serviceName || 'pm2_' + user);
      var destination = path.join('/etc/rc.d', service_name);
      commands = [
        'rcctl stop ' + service_name,
        'rcctl disable ' + service_name,
        'rm ' + destination
      ];
      break;
    };

    require('shelljs').exec(commands.join('&& '), function(code, stdout, stderr) {
      Common.printOut(stdout);
      Common.printOut(stderr);
      if (code == 0) {
        Common.printOut(cst.PREFIX_MSG + chalk.bold('Init file disabled.'));
      } else {
        Common.printOut(cst.ERROR_MSG + chalk.bold('Return code : ' + code));
      }

      cb(null, {
        commands : commands,
        platform : platform
      });
    });
  };

  /**
   * Startup script generation
   * @method startup
   * @param {string} platform type (centos|redhat|amazon|gentoo|systemd)
   */
  CLI.prototype.startup = function(platform, opts, cb) {
    var that = this;
    var actual_platform = detectInitSystem();
    var user = (opts.user || process.env.USER);
    var service_name = (opts.serviceName || 'pm2-' + user);
    var openrc_service_name = 'pm2';
    var launchd_service_name = (opts.serviceName || 'pm2.' + user);

    if (!platform)
      platform = actual_platform;
    else if (actual_platform && actual_platform !== platform) {
      Common.printOut('-----------------------------------------------------------')
      Common.printOut(' PM2 detected ' + actual_platform + ' but you precised ' + platform)
      Common.printOut(' Please verify that your choice is indeed your init system')
      Common.printOut(' If you arent sure, just run : pm2 startup')
      Common.printOut('-----------------------------------------------------------')
    }
    if (platform == null)
      throw new Error('Init system not found');

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

    var destination;
    var commands;
    var template;

    function getTemplate(type) {
      return fs.readFileSync(path.join(__dirname, '..', 'templates/init-scripts', type + '.tpl'), {encoding: 'utf8'});
    }

    switch(platform) {
    case 'ubuntu':
    case 'centos':
    case 'arch':
    case 'oracle':
    case 'systemd':
      if (opts.waitIp)
        template = getTemplate('systemd-online');
      else
        template = getTemplate('systemd');
      destination = '/etc/systemd/system/' + service_name + '.service';
      commands = [
        'systemctl enable ' + service_name
      ];
      break;
    case 'ubuntu14':
    case 'ubuntu12':
    case 'upstart':
      template = getTemplate('upstart');
      destination = '/etc/init.d/' + service_name;
      commands = [
        'chmod +x ' + destination,
        'mkdir -p /var/lock/subsys',
        'touch /var/lock/subsys/' + service_name,
        'update-rc.d ' + service_name + ' defaults'
      ];
      break;
    case 'systemv':
    case 'amazon':
    case 'centos6':
      template = getTemplate('upstart');
      destination = '/etc/init.d/' + service_name;
      commands = [
        'chmod +x ' + destination,
        'mkdir -p /var/lock/subsys',
        'touch /var/lock/subsys/' + service_name,
        'chkconfig --add ' + service_name,
        'chkconfig ' + service_name + ' on',
        'initctl list'
      ];
      break;
    case 'macos':
    case 'darwin':
    case 'launchd':
      template = getTemplate('launchd');
      destination = path.join(process.env.HOME, 'Library/LaunchAgents/' + launchd_service_name + '.plist');
      commands = [
        'launchctl load -w ' + destination
      ]
      break;
    case 'freebsd':
    case 'rcd':
      template = getTemplate('rcd');
      service_name = (opts.serviceName || 'pm2_' + user);
      destination = '/usr/local/etc/rc.d/' + service_name;
      commands = [
        'chmod 755 ' + destination,
        'sysrc ' + service_name + '_enable=YES'
      ];
      break;
    case 'openbsd':
    case 'rcd-openbsd':
      template = getTemplate('rcd-openbsd');
      service_name = (opts.serviceName || 'pm2_' + user);
      destination = path.join('/etc/rc.d/', service_name);
      commands = [
        'chmod 755 ' + destination,
        'rcctl enable ' + service_name,
        'rcctl start ' + service_name
      ];
      break;
    case 'openrc':
      template = getTemplate('openrc');
      service_name = openrc_service_name;
      destination = '/etc/init.d/' + service_name;
      commands = [
        'chmod +x ' + destination,
        'rc-update add ' + service_name + ' default'
      ];
      break;
    default:
      throw new Error('Unknown platform / init system name');
    }

    /**
     * 4# Replace template variable value
     */
    template = template.replace(/%PM2_PATH%/g, process.mainModule.filename)
      .replace(/%NODE_PATH%/g, path.dirname(process.execPath))
      .replace(/%USER%/g, user)
      .replace(/%HOME_PATH%/g, opts.hp ? path.resolve(opts.hp, '.pm2') : cst.PM2_ROOT_PATH)
      .replace(/%SERVICE_NAME%/g, service_name);

    Common.printOut(chalk.bold('Platform'), platform);
    Common.printOut(chalk.bold('Template'));
    Common.printOut(template);
    Common.printOut(chalk.bold('Target path'));
    Common.printOut(destination);
    Common.printOut(chalk.bold('Command list'));
    Common.printOut(commands);

    Common.printOut(cst.PREFIX_MSG + 'Writing init configuration in ' + destination);
    try {
      fs.writeFileSync(destination, template);
    } catch (e) {
      console.error(cst.PREFIX_MSG_ERR + 'Failure when trying to write startup script');
      console.error(e.message || e);
      return cb(e);
    }

    Common.printOut(cst.PREFIX_MSG + 'Making script booting at startup...');

    forEachLimit(commands, 1, function(command, next) {
      Common.printOut(cst.PREFIX_MSG + '[-] Executing: %s...', chalk.bold(command));
      require('shelljs').exec(command, function(code, stdout, stderr) {
        if (code === 0) {
          Common.printOut(cst.PREFIX_MSG + chalk.bold('[v] Command successfully executed.'));
          return next();
        } else {
          Common.printOut(chalk.red('[ERROR] Exit code : ' + code))
          return next(new Error(command + ' failed, see error above.'));
        }
      })
    }, function(err) {
      if (err) {
        console.error(cst.PREFIX_MSG_ERR + (err.message || err));
        return cb(err);
      }
      Common.printOut(chalk.bold.blue('+---------------------------------------+'));
      Common.printOut(chalk.bold.blue((cst.PREFIX_MSG + 'Freeze a process list on reboot via:' )));
      Common.printOut(chalk.bold('$ pm2 save'));
      Common.printOut('');
      Common.printOut(chalk.bold.blue(cst.PREFIX_MSG + 'Remove init script via:'));
      Common.printOut(chalk.bold('$ pm2 unstartup ' + platform));

      return cb(null, {
        destination  : destination,
        template : template
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

        // try to fix issues with empty dump file
        // like #3485
        if (env_arr.length === 0 && !process.env.FORCE) {

          // fix : if no dump file, no process, only module and after pm2 update
          if (!fs.existsSync(cst.DUMP_FILE_PATH)) {
            that.clearDump(function(){});
          }

          // if no process in list don't modify dump file
          // process list should not be empty
          if(cb) {
            return cb(null, {success: true});
          } else  {
            Common.printOut(cst.PREFIX_MSG + 'Nothing to save !!!');
            Common.printOut(cst.PREFIX_MSG + 'In this case we keep old dump file. To clear dump file you can delete it manually !');
            that.exitCli(cst.SUCCESS_EXIT);
            return;
          }
        }

        // Back up dump file
        try {
          if (fs.existsSync(cst.DUMP_FILE_PATH)) {
            fs.writeFileSync(cst.DUMP_BACKUP_FILE_PATH, fs.readFileSync(cst.DUMP_FILE_PATH));
          }
        } catch (e) {
          console.error(e.stack || e);
          Common.printOut(cst.PREFIX_MSG_ERR + 'Failed to back up dump file in %s', cst.DUMP_BACKUP_FILE_PATH);
        }

        // Overwrite dump file, delete if broken and exit
        try {
          fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify(env_arr, '', 2));
        } catch (e) {
          console.error(e.stack || e);
          try {
            // try to backup file
            if (fs.existsSync(cst.DUMP_BACKUP_FILE_PATH)) {
              fs.writeFileSync(cst.DUMP_FILE_PATH, fs.readFileSync(cst.DUMP_BACKUP_FILE_PATH));
            }
          } catch (e) {
            // don't keep broken file
            fs.unlinkSync(cst.DUMP_FILE_PATH);
            console.error(e.stack || e);
          }
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
        delete apps[0].pm2_env.prev_restart_delay;
        if (!apps[0].pm2_env.pmx_module)
          env_arr.push(apps[0].pm2_env);
        apps.shift();
        return ex(apps);
      })(list);
    });
  };

  /**
   * Remove DUMP_FILE_PATH file and DUMP_BACKUP_FILE_PATH file
   * @method dump
   * @param {} cb
   * @return
   */
  CLI.prototype.clearDump = function(cb) {
    fs.writeFileSync(cst.DUMP_FILE_PATH, JSON.stringify([]));

    if(cb && typeof cb === 'function') return cb();

    Common.printOut(cst.PREFIX_MSG + 'Successfully created %s', cst.DUMP_FILE_PATH);
    return this.exitCli(cst.SUCCESS_EXIT);
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

    var processes;

    function readDumpFile(dumpFilePath) {
      Common.printOut(cst.PREFIX_MSG + 'Restoring processes located in %s', dumpFilePath);
      try {
        var apps = fs.readFileSync(dumpFilePath);
      } catch (e) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Failed to read dump file in %s', dumpFilePath);
        throw e;
      }

      return apps;
    }

    function parseDumpFile(dumpFilePath, apps) {
      try {
        var processes = Common.parseConfig(apps, 'none');
      } catch (e) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Failed to parse dump file in %s', dumpFilePath);
        try {
          fs.unlinkSync(dumpFilePath);
        } catch (e) {
          console.error(e.stack || e);
        }
        throw e;
      }

      return processes;
    }

    // Read dump file, fall back to backup, delete if broken
    try {
      apps = readDumpFile(cst.DUMP_FILE_PATH);
      processes = parseDumpFile(cst.DUMP_FILE_PATH, apps);
    } catch(e) {
      try {
        apps = readDumpFile(cst.DUMP_BACKUP_FILE_PATH);
        processes = parseDumpFile(cst.DUMP_BACKUP_FILE_PATH, apps);
      } catch(e) {
        Common.printError(cst.PREFIX_MSG_ERR + 'No processes saved; DUMP file doesn\'t exist');
        // if (cb) return cb(Common.retErr(e));
        // else return that.exitCli(cst.ERROR_EXIT);
        return that.speedList();
      }
    }

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError(err);
        return that.exitCli(1);
      }

      var current = [];
      var target = [];

      list.forEach(function(app) {
        if (!current[app.name])
          current[app.name] = 0;
        current[app.name]++;
      });

      processes.forEach(function(app) {
        if (!target[app.name])
          target[app.name] = 0;
        target[app.name]++;
      });

      var tostart = Object.keys(target).filter(function(i) {
        return Object.keys(current).indexOf(i) < 0;
      })

      eachLimit(processes, cst.CONCURRENT_ACTIONS, function(app, next) {
        if (tostart.indexOf(app.name) == -1)
          return next();
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
    });
  };

}
