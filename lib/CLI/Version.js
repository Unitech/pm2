
var cst     = require('../../constants.js');
var Version = require('./tools/VersionManagement.js');
var Common  = require('../Common.js');
var Satan   = require('../Satan');

module.exports = function(CLI) {

  /**
   * CLI method for updating a repository
   * @method pullAndRestart
   * @param {string} process_name name of processes to pull
   * @return
   */
  CLI.pullAndRestart = function (process_name, cb) {
    Version._pull({process_name: process_name, action: 'reload'}, cb);
  };

  /**
   * CLI method for updating a repository
   * @method pullAndReload
   * @param {string} process_name name of processes to pull
   * @return
   */
  CLI.pullAndReload = function (process_name, cb) {
    Version._pull({process_name: process_name, action: 'reload'}, cb);
  };

  /**
   * CLI method for updating a repository
   * @method pullAndGracefulReload
   * @param {string} process_name name of processes to pull
   * @return
   */
  CLI.pullAndGracefulReload = function (process_name, cb) {
    Version._pull({process_name: process_name, action: 'gracefulReload'}, cb);
  };

  /**
   * CLI method for updating a repository to a specific commit id
   * @method pullCommitId
   * @param {object} opts
   * @return
   */
  CLI.pullCommitId = function (opts, cb) {
    Version.pullCommitId(opts.pm2_name, opts.commit_id, cb);
  };

  /**
   * CLI method for downgrading a repository to the previous commit (older)
   * @method backward
   * @param {string} process_name
   * @return
   */
  CLI.backward = Version.backward;

  /**
   * CLI method for updating a repository to the next commit (more recent)
   * @method forward
   * @param {string} process_name
   * @return
   */
  CLI.forward = Version.forward;


  /**
   * CLI method for triggering garbage collection manually
   * @method forcegc
   * @return
   */
  CLI.forceGc = CLI.gc = function(cb) {
    Satan.executeRemote('forceGc', {}, function(err, data) {
      if (data && data.success === false) {
        Common.printError(cst.PREFIX_MSG_ERR + 'Garbage collection failed');
        return cb ? cb({success:false}) : Common.exitCli(cst.ERROR_EXIT);
      } else {
        Common.printOut(cst.PREFIX_MSG + 'Garbage collection manually triggered');
        return cb ? cb(null, {success:true}) : Common.exitCli(cst.SUCCESS_EXIT);
      }
    });
  };

}
