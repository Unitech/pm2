
var fs                   = require('fs');
var async                = require('async');
var vizion               = require('vizion');
var child                = require('child_process');

var CLI                  = require('../CLI.js');
var Common               = require('../Common.js');
var cst                  = require('../../constants.js');

var exitCli = Common.exitCli;
var printError = Common.printError;
var printOut = Common.printOut;

var EXEC_TIMEOUT = 60000; // Default: 1 min

var Methods = {};

/**
 * CLI method for updating a repository
 * @method _pull
 * @param {object} opts
 * @return
 */
Methods._pull = function(opts, cb) {
  var process_name = opts.process_name;
  var reload_type = opts.action;

  printOut(cst.PREFIX_MSG + 'Updating repository for process name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:'Process not found: '+process_name}) : exitCli(cst.ERROR_EXIT);
    }

    var proc = processes[0];
    if (!proc.pm2_env.versioning) {
      printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
      return cb ? cb({success:false, msg: 'No versioning system found for process'}) : exitCli(cst.SUCCESS_EXIT);
    }
    vizion.update({
      folder: proc.pm2_env.versioning.repo_path
    }, function(err, meta) {
      if (err !== null) {
        return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
      }

      if (meta.success === true) {
        getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
          execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
            if (err !== null) {
              printError(err);
              return cb ? cb({msg: meta.output + err}) : exitCli(cst.ERROR_EXIT);
            }
            else {
              printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
              printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
              return CLI[reload_type](process_name, function(err, procs) {
                if (err) return cb(err);
                return cb ? cb(null, meta.output + res) : exitCli(cst.SUCCESS_EXIT);
              });
            }
          });
        });
      }
      else {
        printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured for app: %s', process_name);
        return cb ? cb({success:false, msg : 'Already up to date'}) : exitCli(cst.SUCCESS_EXIT);
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
Methods.pullCommitId = function(process_name, commit_id, cb) {
  var reload_type = 'reload';

  printOut(cst.PREFIX_MSG + 'Updating repository for process name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:'Process not found: ' + process_name}) : exitCli(cst.ERROR_EXIT);
    }

    var proc = processes[0];
    if (proc.pm2_env.versioning) {
      vizion.isUpToDate({folder: proc.pm2_env.versioning.repo_path},
      function(err, meta) {
        if (err !== null)
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        vizion.revertTo(
          {revision: commit_id,
           folder: proc.pm2_env.versioning.repo_path},
          function(err2, meta2) {
            if (!err2 && meta2.success) {
              getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name,
              function (command_list) {
              execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
                if (err !== null)
                {
                  printError(err);
                  return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
                }
                else {
                  printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                  printOut(cst.PREFIX_MSG + 'Current commit %s', commit_id);
                  return CLI[reload_type](process_name, cb);
                }
              });
            });
          }
          else {
            printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured: %s', process_name);
            return cb ? cb(null, {success:meta.success}) : exitCli(cst.SUCCESS_EXIT);
          }
        });
      });
    }
    else {
      printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
      return cb ? cb(null, {success:false}) : exitCli(cst.SUCCESS_EXIT);
    }
  });
};

/**
 * CLI method for downgrading a repository to the previous commit (older)
 * @method backward
 * @param {string} process_name
 * @return
 */
Methods.backward = function(process_name, cb) {
  printOut(cst.PREFIX_MSG + 'Downgrading to previous commit repository for process name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:'Process not found: '+process_name}) : exitCli(cst.ERROR_EXIT);
    }

    var proc = processes[0];

    if (proc.pm2_env.versioning === undefined ||
        proc.pm2_env.versioning === null)
      return cb({msg : 'Versioning unknown'});

    vizion.prev({
      folder: proc.pm2_env.versioning.repo_path
    }, function(err, meta) {
      if (err)
        return cb ? cb({msg:err, data : meta}) : exitCli(cst.ERROR_EXIT);

      if (meta.success !== true) {
        printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
        return cb ? cb({msg:err, data : meta}) : exitCli(cst.ERROR_EXIT);;
      }

      getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name, function (command_list) {
        execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
          if (err !== null) {
            vizion.next({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta2) {
              printError(err);
              return cb ? cb({msg: meta.output + err}) : exitCli(cst.ERROR_EXIT);
            });
            return false;
          }

          printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
          printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
          CLI.reload(process_name, function(err, procs) {
            if (err) return cb(err);
            return cb ? cb(null, meta.output + res) : exitCli(cst.SUCCESS_EXIT);
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
Methods.forward = function(process_name, cb) {

  printOut(cst.PREFIX_MSG + 'Updating to next commit repository for process name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:'Process not found: '+process_name}) : exitCli(cst.ERROR_EXIT);
    }

    var proc = processes[0];
    if (proc.pm2_env.versioning) {
      vizion.next({folder: proc.pm2_env.versioning.repo_path},
      function(err, meta) {
        if (err !== null)
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        if (meta.success === true) {
          getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name,
          function (command_list) {
            execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err, res) {
              if (err !== null)
              {
                vizion.prev({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta2) {
                  printError(err);
                  return cb ? cb({msg:meta.output + err}) : exitCli(cst.ERROR_EXIT);
                });
              }
              else {
                printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
                CLI.reload(process_name, function(err, procs) {
                  if (err) return cb(err);
                  return cb ? cb(null, meta.output + res) : exitCli(cst.SUCCESS_EXIT);
                });
              }
            });
          });
        }
        else {
          printOut(cst.PREFIX_MSG + 'Already up-to-date or an error occured: %s', process_name);
          return cb ? cb(null, {success:meta.success}) : exitCli(cst.SUCCESS_EXIT);
        }
      });
    }
    else {
      printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
      return cb ? cb({success:false, msg: 'No versioning system found'}) : exitCli(cst.SUCCESS_EXIT);
    }
  });
};

var exec = function (cmd, callback) {
  var output = '';

  var c = child.exec(cmd, {env: process.env, maxBuffer: 3*1024*1024, timeout: EXEC_TIMEOUT},
  function(err) {
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

  async.eachSeries(command_list, function(command, callback) {
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
          var data = JSON.parse(fs.readFileSync(repo_path + file).toString());
        } catch (e) {}

        if (data && data.apps) {
          async.eachSeries(data.apps, function(item, callb) {
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

  async.eachSeries(['ecosystem.json', 'process.json', 'package.json'], searchForCommands,
  function(final) {
    return cb(final ? final : []);
  });
};

module.exports = Methods;
