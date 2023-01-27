var chalk  = require('chalk');
var util   = require('util');
var fs     = require('fs');
var exec   = require('child_process').exec;
var path   = require('path');

var Log    = require('./Log');
var cst    = require('../../constants.js');
var Common = require('../Common.js');

module.exports = function(CLI) {

  /**
   * Description
   * @method flush
   * @return
   */
  CLI.prototype.flush = function(api, cb) {
    var that = this;

    if (!api) {
      Common.printOut(cst.PREFIX_MSG + 'Flushing ' + cst.PM2_LOG_FILE_PATH);
      fs.closeSync(fs.openSync(cst.PM2_LOG_FILE_PATH, 'w'));
    }

    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      list.forEach(function(l) {
        if (typeof api == 'undefined') {
          Common.printOut(cst.PREFIX_MSG + 'Flushing:');
          Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
          Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);

          if (l.pm2_env.pm_log_path) {
            Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_log_path);
            fs.closeSync(fs.openSync(l.pm2_env.pm_log_path, 'w'));
          }
          fs.closeSync(fs.openSync(l.pm2_env.pm_out_log_path, 'w'));
          fs.closeSync(fs.openSync(l.pm2_env.pm_err_log_path, 'w'));
        }
        else if (l.pm2_env.pm_id == api || l.pm2_env.name === api) {
          Common.printOut(cst.PREFIX_MSG + 'Flushing:');

          if (l.pm2_env.pm_log_path && fs.existsSync(l.pm2_env.pm_log_path)) {
            Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_log_path);
            fs.closeSync(fs.openSync(l.pm2_env.pm_log_path, 'w'));
          }

          if (l.pm2_env.pm_out_log_path && fs.existsSync(l.pm2_env.pm_out_log_path)) {
            Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_out_log_path);
            fs.closeSync(fs.openSync(l.pm2_env.pm_out_log_path, 'w'));
          }

          if (l.pm2_env.pm_err_log_path && fs.existsSync(l.pm2_env.pm_err_log_path)) {
            Common.printOut(cst.PREFIX_MSG + l.pm2_env.pm_err_log_path);
            fs.closeSync(fs.openSync(l.pm2_env.pm_err_log_path, 'w'));
          }
        }
      });

      Common.printOut(cst.PREFIX_MSG + 'Logs flushed');
      return cb ? cb(null, list) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  CLI.prototype.logrotate = function(opts, cb) {
    var that = this;

    if (process.getuid() != 0) {
      return exec('whoami', function(err, stdout, stderr) {
        Common.printError(cst.PREFIX_MSG + 'You have to run this command as root. Execute the following command:');
        Common.printError(cst.PREFIX_MSG + chalk.grey('      sudo env PATH=$PATH:' + path.dirname(process.execPath) + ' pm2 logrotate -u ' + stdout.trim()));

        cb ? cb(Common.retErr('You have to run this with elevated rights')) : that.exitCli(cst.ERROR_EXIT);
      });
    }

    if (!fs.existsSync('/etc/logrotate.d')) {
      Common.printError(cst.PREFIX_MSG + '/etc/logrotate.d does not exist we can not copy the default configuration.');
      return cb ? cb(Common.retErr('/etc/logrotate.d does not exist')) : that.exitCli(cst.ERROR_EXIT);
    }

    var templatePath = path.join(cst.TEMPLATE_FOLDER, cst.LOGROTATE_SCRIPT);
    Common.printOut(cst.PREFIX_MSG + 'Getting logrorate template ' + templatePath);
    var script = fs.readFileSync(templatePath, {encoding: 'utf8'});

    var user = opts.user || 'root';

    script = script.replace(/%HOME_PATH%/g, cst.PM2_ROOT_PATH)
      .replace(/%USER%/g, user);

    try {
      fs.writeFileSync('/etc/logrotate.d/pm2-'+user, script);
    } catch (e) {
      console.error(e.stack || e);
    }

    Common.printOut(cst.PREFIX_MSG + 'Logrotate configuration added to /etc/logrotate.d/pm2');
    return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
  };

  /**
   * Description
   * @method reloadLogs
   * @return
   */
  CLI.prototype.reloadLogs = function(cb) {
    var that = this;

    Common.printOut('Reloading all logs...');
    that.Client.executeRemote('reloadLogs', {}, function(err, logs) {
      if (err) {
        Common.printError(err);
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('All logs reloaded');
      return cb ? cb(null, logs) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  /**
   * Description
   * @method streamLogs
   * @param {String} id
   * @param {Number} lines
   * @param {Boolean} raw
   * @return
   */
  CLI.prototype.streamLogs = function(id, lines, raw, timestamp, exclusive, highlight) {
    var that = this;
    var files_list = [];

    // If no argument is given, we stream logs for all running apps
    id = id || 'all';
    lines = lines !== undefined ? lines : 20;
    lines = lines < 0 ? -(lines) : lines;

    // Avoid duplicates and check if path is different from '/dev/null'
    var pushIfUnique = function(entry) {
      var exists = false;

      if (entry.path.toLowerCase
          && entry.path.toLowerCase() !== '/dev/null') {

        files_list.some(function(file) {
          if (file.path === entry.path)
            exists = true;
          return exists;
        });

        if (exists)
          return;

        files_list.push(entry);
      }
    }

    // Get the list of all running apps
    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      var regexList = [];
      var namespaceList = [];

      if (err) {
        Common.printError(err);
        that.exitCli(cst.ERROR_EXIT);
      }

      if (lines === 0)
        return Log.stream(that.Client, id, raw, timestamp, exclusive, highlight);

      Common.printOut(chalk.bold.grey(util.format.call(this, '[TAILING] Tailing last %d lines for [%s] process%s (change the value with --lines option)', lines, id, id === 'all' ? 'es' : '')));

      // Populate the array `files_list` with the paths of all files we need to tail
      list.forEach(function(proc) {
        if (proc.pm2_env && (id === 'all' ||
                             proc.pm2_env.name == id ||
                             proc.pm2_env.pm_id == id)) {
          if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
            pushIfUnique({
              path     : proc.pm2_env.pm_out_log_path,
              app_name :proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'out'});
          if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
            pushIfUnique({
              path     : proc.pm2_env.pm_err_log_path,
              app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'err'
            });
        } else if(proc.pm2_env && proc.pm2_env.namespace == id) {
          if(namespaceList.indexOf(proc.pm2_env.name) === -1) {
            namespaceList.push(proc.pm2_env.name)
          }
          if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
            pushIfUnique({
              path     : proc.pm2_env.pm_out_log_path,
              app_name :proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'out'});
          if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
            pushIfUnique({
              path     : proc.pm2_env.pm_err_log_path,
              app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'err'
            });
        }
        // Populate the array `files_list` with the paths of all files we need to tail, when log in put is a regex
        else if(proc.pm2_env && (isNaN(id) && id[0] === '/' && id[id.length - 1] === '/')) {
          var regex = new RegExp(id.replace(/\//g, ''));
          if(regex.test(proc.pm2_env.name)) {
            if(regexList.indexOf(proc.pm2_env.name) === -1) {
              regexList.push(proc.pm2_env.name);
            }
            if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
              pushIfUnique({
                path     : proc.pm2_env.pm_out_log_path,
                app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type     : 'out'});
            if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
              pushIfUnique({
                path     : proc.pm2_env.pm_err_log_path,
                app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type     : 'err'
              });
          }
        }
      });

    //for fixing issue https://github.com/Unitech/pm2/issues/3506
     /* if (files_list && files_list.length == 0) {
        Common.printError(cst.PREFIX_MSG_ERR + 'No file to stream for app [%s], exiting.', id);
        return process.exit(cst.ERROR_EXIT);
      }*/

      if (!raw && (id === 'all' || id === 'PM2') && exclusive === false) {
        Log.tail([{
          path     : cst.PM2_LOG_FILE_PATH,
          app_name : 'PM2',
          type     : 'PM2'
        }], lines, raw, function() {
          Log.tail(files_list, lines, raw, function() {
            Log.stream(that.Client, id, raw, timestamp, exclusive, highlight);
          });
        });
      }
      else {
        Log.tail(files_list, lines, raw, function() {
          if(regexList.length > 0) {
            regexList.forEach(function(id) {
                Log.stream(that.Client, id, raw, timestamp, exclusive, highlight);
            })
          }
          else if(namespaceList.length > 0) {
            namespaceList.forEach(function(id) {
                Log.stream(that.Client, id, raw, timestamp, exclusive, highlight);
            })
          }
          else {
            Log.stream(that.Client, id, raw, timestamp, exclusive, highlight);
          }
        });
      }
    });
  };

  /**
   * Description
   * @method printLogs
   * @param {String} id
   * @param {Number} lines
   * @param {Boolean} raw
   * @return
   */
  CLI.prototype.printLogs = function(id, lines, raw, timestamp, exclusive) {
    var that = this;
    var files_list = [];

    // If no argument is given, we stream logs for all running apps
    id = id || 'all';
    lines = lines !== undefined ? lines : 20;
    lines = lines < 0 ? -(lines) : lines;

    // Avoid duplicates and check if path is different from '/dev/null'
    var pushIfUnique = function(entry) {
      var exists = false;

      if (entry.path.toLowerCase
          && entry.path.toLowerCase() !== '/dev/null') {

        files_list.some(function(file) {
          if (file.path === entry.path)
            exists = true;
          return exists;
        });

        if (exists)
          return;

        files_list.push(entry);
      }
    }

    // Get the list of all running apps
    that.Client.executeRemote('getMonitorData', {}, function(err, list) {
      if (err) {
        Common.printError(err);
        that.exitCli(cst.ERROR_EXIT);
      }

      if (lines <= 0) {
        return that.exitCli(cst.SUCCESS_EXIT)
      }

      Common.printOut(chalk.bold.grey(util.format.call(this, '[TAILING] Tailing last %d lines for [%s] process%s (change the value with --lines option)', lines, id, id === 'all' ? 'es' : '')));

      // Populate the array `files_list` with the paths of all files we need to tail
      list.forEach(function(proc) {
        if (proc.pm2_env && (id === 'all' ||
                             proc.pm2_env.name == id ||
                             proc.pm2_env.pm_id == id)) {
          if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
            pushIfUnique({
              path     : proc.pm2_env.pm_out_log_path,
              app_name :proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'out'});
          if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
            pushIfUnique({
              path     : proc.pm2_env.pm_err_log_path,
              app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
              type     : 'err'
            });
        }
        // Populate the array `files_list` with the paths of all files we need to tail, when log in put is a regex
        else if(proc.pm2_env && (isNaN(id) && id[0] === '/' && id[id.length - 1] === '/')) {
          var regex = new RegExp(id.replace(/\//g, ''));
          if(regex.test(proc.pm2_env.name)) {
            if (proc.pm2_env.pm_out_log_path && exclusive !== 'err')
              pushIfUnique({
                path     : proc.pm2_env.pm_out_log_path,
                app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type     : 'out'});
            if (proc.pm2_env.pm_err_log_path && exclusive !== 'out')
              pushIfUnique({
                path     : proc.pm2_env.pm_err_log_path,
                app_name : proc.pm2_env.pm_id + '|' + proc.pm2_env.name,
                type     : 'err'
              });
          }
        }
      });

      if (!raw && (id === 'all' || id === 'PM2') && exclusive === false) {
        Log.tail([{
          path     : cst.PM2_LOG_FILE_PATH,
          app_name : 'PM2',
          type     : 'PM2'
        }], lines, raw, function() {
          Log.tail(files_list, lines, raw, function() {
            that.exitCli(cst.SUCCESS_EXIT);
          });
        });
      }
      else {
        Log.tail(files_list, lines, raw, function() {
          that.exitCli(cst.SUCCESS_EXIT);
        });
      }
    });
  };
};
