/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var fs      = require('fs');
var cst     = require('../../constants.js');
var Utility = require('../Utility.js');
var Common  = require('../Common.js');

function deployHelper() {
  console.log('');
  console.log('-----> Helper: Deployment with PM2');
  console.log('');
  console.log('  Generate a sample ecosystem.config.js with the command');
  console.log('  $ pm2 ecosystem');
  console.log('  Then edit the file depending on your needs');
  console.log('');
  console.log('  Commands:');
  console.log('    setup                run remote setup commands');
  console.log('    update               update deploy to the latest release');
  console.log('    revert [n]           revert to [n]th last deployment or 1');
  console.log('    curr[ent]            output current release commit');
  console.log('    prev[ious]           output previous release commit');
  console.log('    exec|run <cmd>       execute the given <cmd>');
  console.log('    list                 list previous deploy commits');
  console.log('    [ref]                deploy to [ref], the "ref" setting, or latest tag');
  console.log('');
  console.log('');
  console.log('  Basic Examples:');
  console.log('');
  console.log('    First initialize remote production host:');
  console.log('    $ pm2 deploy ecosystem.config.js production setup');
  console.log('');
  console.log('    Then deploy new code:');
  console.log('    $ pm2 deploy ecosystem.config.js production');
  console.log('');
  console.log('    If I want to revert to the previous commit:');
  console.log('    $ pm2 deploy ecosystem.config.js production revert 1');
  console.log('');
  console.log('    Execute a command on remote server:');
  console.log('    $ pm2 deploy ecosystem.config.js production exec "pm2 restart all"');
  console.log('');
  console.log('    PM2 will look by default to the ecosystem.config.js file so you dont need to give the file name:');
  console.log('    $ pm2 deploy production');
  console.log('    Else you have to tell PM2 the name of your ecosystem file');
  console.log('');
  console.log('    More examples in https://github.com/Unitech/pm2');
  console.log('');
};

module.exports = function(CLI) {
  CLI.prototype.deploy = function(file, commands, cb) {
    var that = this;

    if (file == 'help') {
      deployHelper();
      return cb ? cb() : that.exitCli(cst.SUCCESS_EXIT);
    }

    var args = commands.rawArgs;
    var env;

    args.splice(0, args.indexOf('deploy') + 1);

    // Find ecosystem file by default
    if (!Common.isConfigFile(file)) {
      env = args[0];
      var defaultConfigNames = ['ecosystem.config.js', 'ecosystem.json', 'ecosystem.json5', 'package.json'];
      file = Utility.whichFileExists(defaultConfigNames);

      if (!file) {
        Common.printError('Not any default deployment file exists.'+
          ' Allowed default config file names are: ' + defaultConfigNames.join(', '));
        return cb ? cb('Not any default ecosystem file present') : that.exitCli(cst.ERROR_EXIT);
      }
    }
    else
      env = args[1];

    var json_conf = null;

    try {
      json_conf = Common.parseConfig(fs.readFileSync(file), file);
    } catch (e) {
      Common.printError(e);
      return cb ? cb(e) : that.exitCli(cst.ERROR_EXIT);
    }

    if (!env) {
      deployHelper();
      return cb ? cb() : that.exitCli(cst.SUCCESS_EXIT);
    }

    if (!json_conf.deploy || !json_conf.deploy[env]) {
      Common.printError('%s environment is not defined in %s file', env, file);
      return cb ? cb('%s environment is not defined in %s file') : that.exitCli(cst.ERROR_EXIT);
    }

    if (!json_conf.deploy[env]['post-deploy']) {
      json_conf.deploy[env]['post-deploy'] = 'pm2 startOrRestart ' + file + ' --env ' + env;
    }

    require('pm2-deploy').deployForEnv(json_conf.deploy, env, args, function(err, data) {
      if (err) {
        Common.printError('Deploy failed');
        Common.printError(err.message || err);
        return cb ? cb(err) : that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut('--> Success');
      return cb ? cb(null, data) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

};
