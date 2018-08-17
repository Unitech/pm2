
var cst        = require('../../constants.js');
var Common     = require('../Common.js');
var fs         = require('fs');
var eachSeries = require('async/eachSeries');
var child      = require('child_process');

var printError = Common.printError;
var printOut = Common.printOut;

module.exports = function(CLI) {

  var EXEC_TIMEOUT = 60000; // Default: 1 min

  CLI.prototype._pull = function(opts, cb) {
    var that = this;

    var process_name = opts.process_name;
    var reload_type = opts.action;

    printOut(cst.PREFIX_MSG + 'Updating repository for process name %s', process_name);

    that.Client.getProcessByNameOrId(process_name, function (err, processes) {

      if (err || processes.length === 0) {
        printError('No processes with this name or id : %s', process_name);
        return cb ? cb({msg: 'Process not found: ' + process_name}) : that.exitCli(cst.ERROR_EXIT);
      }

      var proc = processes[0];
      if (!proc.pm2_env.versioning) {
        printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
        return cb ? cb({success:false, msg: 'No versioning system found for process'}) : that.exitCli(cst.SUCCESS_EXIT);
      }
      require('vizion').update({
        folder: proc.pm2_env.versioning.repo_path
      }, function(err, meta) {
        if (err !== null) {
          return cb ? cb({msg:err}) : that.exitCli(cst.ERROR_EXIT);
        }

        if (meta.success === true) {
          getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
            execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
              if (err !== null) {
                printError(err);
                return cb ? cb({msg: meta.output + err}) : that.exitCli(cst.ERROR_EXIT);
              }
              else {
                printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
                return that[reload_type](process_name, function(err, procs) {
                  if (err && cb) return cb(err);
                  if (err) console.error(err);
                  return cb ? cb(null, meta.output + res) : that.exitCli(cst.SUCCESS_EXIT);
                });
              }
            });
          });
        }
        else {
          printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured for app: %s', process_name);
          return cb ? cb({success:false, msg : 'Already up to date'}) : that.exitCli(cst.SUCCESS_EXIT);
        }
        return false;
      });
      return false;
    });
  };

  /**
   * CLI method for updating a repository to a specific commit id
   * @method pullCommitId
   * @param {string} process_name
   * @param {string} commit_id
   * @return
   */
  CLI.prototype.pullCommitId = function(process_name, commit_id, cb) {
    var reload_type = 'reload';
    var that = this;

    printOut(cst.PREFIX_MSG + 'Updating repository for process name %s', process_name);

    that.Client.getProcessByNameOrId(process_name, function (err, processes) {

      if (err || processes.length === 0) {
        printError('No processes with this name or id : %s', process_name);
        return cb ? cb({msg: 'Process not found: ' + process_name}) : that.exitCli(cst.ERROR_EXIT);
      }

      var proc = processes[0];
      if (proc.pm2_env.versioning) {
        require('vizion').isUpToDate({folder: proc.pm2_env.versioning.repo_path}, function(err, meta) {
          if (err !== null)
            return cb ? cb({msg:err}) : that.exitCli(cst.ERROR_EXIT);
          require('vizion').revertTo(
            {revision: commit_id,
             folder: proc.pm2_env.versioning.repo_path},
            function(err2, meta2) {
              if (!err2 && meta2.success) {
                getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
                  execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
                    if (err !== null)
                    {
                      printError(err);
                      return cb ? cb({msg:err}) : that.exitCli(cst.ERROR_EXIT);
                    }
                    else {
                      printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                      printOut(cst.PREFIX_MSG + 'Current commit %s', commit_id);
                      return that[reload_type](process_name, cb);
                    }
                  });
                });
              }
              else {
                printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured: %s', process_name);
                return cb ? cb(null, {success:meta.success}) : that.exitCli(cst.SUCCESS_EXIT);
              }
            });
        });
      }
      else {
        printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
        return cb ? cb(null, {success:false}) : that.exitCli(cst.SUCCESS_EXIT);
      }
    });
  };

  /**
   * CLI method for downgrading a repository to the previous commit (older)
   * @method backward
   * @param {string} process_name
   * @return
   */
  CLI.prototype.backward = function(process_name, cb) {
    var that = this;
    printOut(cst.PREFIX_MSG + 'Downgrading to previous commit repository for process name %s', process_name);

    that.Client.getProcessByNameOrId(process_name, function (err, processes) {

      if (err || processes.length === 0) {
        printError('No processes with this name or id : %s', process_name);
        return cb ? cb({msg: 'Process not found: ' + process_name}) : that.exitCli(cst.ERROR_EXIT);
      }

      var proc = processes[0];
      // in case user searched by id/pid
      process_name = proc.name;

      if (proc.pm2_env.versioning === undefined ||
          proc.pm2_env.versioning === null)
        return cb({msg : 'Versioning unknown'});

      require('vizion').prev({
        folder: proc.pm2_env.versioning.repo_path
      }, function(err, meta) {
        if (err)
          return cb ? cb({msg:err, data : meta}) : that.exitCli(cst.ERROR_EXIT);

        if (meta.success !== true) {
          printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
          return cb ? cb({msg:err, data : meta}) : that.exitCli(cst.ERROR_EXIT);;
        }

        getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
          execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
            if (err !== null) {
              require('vizion').next({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta2) {
                printError(err);
                return cb ? cb({msg: meta.output + err}) : that.exitCli(cst.ERROR_EXIT);
              });
              return false;
            }

            printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
            printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
            that.reload(process_name, function(err, procs) {
              if (err) return cb(err);
              return cb ? cb(null, meta.output + res) : that.exitCli(cst.SUCCESS_EXIT);
            });
          });
        });
      });
    });
  };

  /**
   * CLI method for updating a repository to the next commit (more recent)
   * @method forward
   * @param {string} process_name
   * @return
   */
  CLI.prototype.forward = function(process_name, cb) {
    var that = this;
    printOut(cst.PREFIX_MSG + 'Updating to next commit repository for process name %s', process_name);

    that.Client.getProcessByNameOrId(process_name, function (err, processes) {

      if (err || processes.length === 0) {
        printError('No processes with this name or id: %s', process_name);
        return cb ? cb({msg: 'Process not found: ' + process_name}) : that.exitCli(cst.ERROR_EXIT);
      }

      var proc = processes[0];
      // in case user searched by id/pid
      process_name = proc.name;
      if (proc.pm2_env.versioning) {
        require('vizion').next({folder: proc.pm2_env.versioning.repo_path}, function(err, meta) {
          if (err !== null)
            return cb ? cb({msg:err}) : that.exitCli(cst.ERROR_EXIT);
          if (meta.success === true) {
            getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
              execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
                if (err !== null)
                {
                  require('vizion').prev({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta2) {
                    printError(err);
                    return cb ? cb({msg:meta.output + err}) : that.exitCli(cst.ERROR_EXIT);
                  });
                }
                else {
                  printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                  printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
                  that.reload(process_name, function(err, procs) {
                    if (err) return cb(err);
                    return cb ? cb(null, meta.output + res) : that.exitCli(cst.SUCCESS_EXIT);
                  });
                }
              });
            });
          }
          else {
            printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured: %s', process_name);
            return cb ? cb(null, {success:meta.success}) : that.exitCli(cst.SUCCESS_EXIT);
          }
        });
      }
      else {
        printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
        return cb ? cb({success:false, msg: 'No versioning system found'}) : that.exitCli(cst.SUCCESS_EXIT);
      }
    });
  };

  var exec = function (cmd, callback) {
    var output = '';

    var c = child.exec(cmd, {
      env: process.env,
      maxBuffer: 3*1024*1024,
      timeout: EXEC_TIMEOUT
    }, function(err) {
      if (callback)
        callback(err ? err.code : 0, output);
    });

    c.stdout.on('data', function(data) {
      output += data;
    });

    c.stderr.on('data', function(data) {
      output += data;
    });
  };

  /**
   *
   * @method execCommands
   * @param {string} repo_path
   * @param {object} command_list
   * @return
   */
  var execCommands = function(repo_path, command_list, cb) {
    var stdout = '';

    eachSeries(command_list, function(command, callback) {
      stdout += '\n' + command;
      exec('cd '+repo_path+';'+command,
           function(code, output) {
             stdout += '\n' + output;
             if (code === 0)
               callback();
             else
               callback('`'+command+'` failed');
           });
    }, function(err) {
      if (err)
        return cb(stdout + '\n' + err);
      return cb(null, stdout);
    });
  }

  /**
   * Description Search process.json for post-update commands
   * @method getPostUpdateCmds
   * @param {string} repo_path
   * @param {string} proc_name
   * @return
   */
  var getPostUpdateCmds = function(repo_path, proc_name, cb) {
    if (typeof repo_path !== 'string')
      return cb([]);
    if (repo_path[repo_path.length - 1] !== '/')
      repo_path += '/';

    var searchForCommands = function(file, callback) {
      fs.exists(repo_path+file, function(exists) {
        if (exists) {
          try {
            var conf_string = fs.readFileSync(repo_path + file);
            var data = Common.parseConfig(conf_string, repo_path + file);
          } catch (e) {
            console.error(e.message || e);
          }

          if (data && data.apps) {
            eachSeries(data.apps, function(item, callb) {
              if (item.name && item.name === proc_name) {
                if (item.post_update && typeof(item.post_update) === 'object') {
                  if (item.exec_timeout)
                    EXEC_TIMEOUT = parseInt(item.exec_timeout);
                  return callb(item.post_update);
                }
                else {
                  return callb();
                }
              }
              else
                return callb();
            }, function(final) {
              return callback(final);
            });
          }
          else {
            return callback();
          }
        }
        else {
          return callback();
        }
      });
    };

    eachSeries(['ecosystem.json', 'process.json', 'package.json'], searchForCommands,
                     function(final) {
                       return cb(final ? final : []);
                     });
  };


  /**
   * CLI method for updating a repository
   * @method pullAndRestart
   * @param {string} process_name name of processes to pull
   * @return
   */
  CLI.prototype.pullAndRestart = function (process_name, cb) {
    this._pull({process_name: process_name, action: 'reload'}, cb);
  };

  /**
   * CLI method for updating a repository
   * @method pullAndReload
   * @param {string} process_name name of processes to pull
   * @return
   */
  CLI.prototype.pullAndReload = function (process_name, cb) {
    this._pull({process_name: process_name, action: 'reload'}, cb);
  };

  /**
   * CLI method for updating a repository to a specific commit id
   * @method pullCommitId
   * @param {object} opts
   * @return
   */
  CLI.prototype._pullCommitId = function (opts, cb) {
    this.pullCommitId(opts.pm2_name, opts.commit_id, cb);
  };

}
