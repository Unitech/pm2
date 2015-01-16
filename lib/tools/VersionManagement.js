var fs                   = require('fs');
var async                = require('async');
var vizion               = require('vizion');
var shell                = require('shelljs');

var CLI                  = require('../CLI.js');
var Common               = require('../Common.js');
var cst                  = require('../../constants.js');


var exitCli = Common.exitCli;
var printError = Common.printError;
var printOut = Common.printOut;

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
    // io.emit_keymetrics('progess', '10%');
    if (proc.pm2_env.versioning) {
      vizion.update({folder: proc.pm2_env.versioning.repo_path},
      function(err, meta) {
        if (err !== null)
          return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
        // io.emit_keymetrics('progess', '50%');
        if (meta.success === true) {
          getPostUpdateCmds(proc.pm2_env.versioning.repo_path, process_name,
          function (command_list) {
            execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err) {
              if (err !== null)
              {
                printError(err);
                return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
              }
              else {
                // io.emit_keymetrics('progess', '90%');
                printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
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
    }
    else {
      printOut(cst.PREFIX_MSG + 'No versioning system found for process %s', process_name);
      return cb ? cb(null, {success:false}) : exitCli(cst.SUCCESS_EXIT);
    }
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
  var reload_type = 'restart';

  printOut(cst.PREFIX_MSG + 'Updating repository for process name %s', process_name);

  Common.getProcessByName(process_name, function(err, processes) {

    if (processes.length === 0) {
      printError('No processes with this name: %s', process_name);
      return cb ? cb({msg:'Process not found: '+process_name}) : exitCli(cst.ERROR_EXIT);
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
              execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err) {
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
        execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err) {
          /**
           * @joni
           * Comment recuperer l'output d'execCommands?
           */

          if (err !== null) {
            vizion.next({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta) {
              printError(err);
              return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
            });
            return false;
          }

          printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
          printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
          return CLI.gracefulReload(process_name, cb);
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
            execCommands(proc.pm2_env.versioning.repo_path, command_list, function(err) {
              if (err !== null)
              {
                vizion.prev({folder: proc.pm2_env.versioning.repo_path}, function(err2, meta) {
                  printError(err);
                  return cb ? cb({msg:err}) : exitCli(cst.ERROR_EXIT);
                });
              }
              else {
                printOut(cst.PREFIX_MSG + 'Process successfully updated %s', process_name);
                printOut(cst.PREFIX_MSG + 'Current commit %s', meta.current_revision);
                return CLI.gracefulReload(process_name, cb);
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
      return cb ? cb(null, {success:false}) : exitCli(cst.SUCCESS_EXIT);
    }
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
  async.eachSeries(command_list, function(command, callback) {
    shell.exec('cd '+repo_path+';'+command, {silent:true},
    function(code, output) {
      if (code === 0)
        callback();
      else
        callback('error');
    });
  }, function(err) {
    if (err)
      return cb('Some command exited with code 1');
    return cb(null);
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
  if (repo_path[repo_path.length - 1] !== '/')
    repo_path += '/';

  var searchForCommands = function(file, callback) {
    fs.exists(repo_path+file, function(exists) {
      if (exists) {
        var data = require(repo_path+file);
        if (data && data.apps) {
          async.eachSeries(data.apps, function(item, callb) {
            if (item.name && item.name === proc_name) {
              if (item.post_update && typeof(item.post_update) === 'object') {
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
