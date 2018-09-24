var path          = require('path');
var fs            = require('fs');
var os            = require('os');
var parallel      = require('async/parallel');
var eachLimit     = require('async/eachLimit');
var forEachLimit  = require('async/forEachLimit');
var p             = path;
var readline      = require('readline');
var spawn         = require('child_process').spawn;
var chalk         = require('chalk');
var Configuration = require('../../Configuration.js');
var cst           = require('../../../constants.js');
var Common        = require('../../Common');
var Utility       = require('../../Utility.js');

var Rollback = {
  revert : function(CLI, module_name, cb) {
    var canonic_module_name = Utility.getCanonicModuleName(module_name);
    var backup_path = path.join(require('os').tmpdir(), canonic_module_name);
    var module_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);

    try {
      fs.statSync(backup_path)
    } catch(e) {
      return cb(new Error('no backup found'));
    }

    Common.printOut(cst.PREFIX_MSG_MOD + chalk.bold.red('[[[[[ Module installation failure! ]]]]]'));
    Common.printOut(cst.PREFIX_MSG_MOD + chalk.bold.red('[RESTORING TO PREVIOUS VERSION]'));

    CLI.deleteModule(canonic_module_name, function() {
      // Delete failing module
      require('shelljs').rm('-r', module_path);
      // Restore working version
      require('shelljs').cp('-r', backup_path, cst.DEFAULT_MODULE_PATH);

      var proc_path = path.join(module_path, 'node_modules', canonic_module_name);
      var package_json_path = path.join(proc_path, 'package.json');

      // Start module
      startModule(CLI, {
        cmd : package_json_path,
        development_mode : false,
        proc_path : proc_path
      }, cb);
    });
  },
  backup : function(module_name) {
    // Backup current module
    var tmpdir = require('os').tmpdir();
    var canonic_module_name = Utility.getCanonicModuleName(module_name);
    var module_path = path.join(cst.DEFAULT_MODULE_PATH, canonic_module_name);
    require('shelljs').cp('-r', module_path, tmpdir);
  }
}

module.exports = Rollback
