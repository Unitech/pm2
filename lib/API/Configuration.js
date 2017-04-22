
var Password             = require('../Interactor/Password.js');
var Common               = require('../Common.js');
var cst                  = require('../../constants.js');
var UX                   = require('./CliUx');
var chalk                = require('chalk');
var async                = require('async');
var Configuration        = require('../Configuration.js');
//@todo double check that imported methods works
var InteractorDaemonizer = require('../Interactor/InteractorDaemonizer');

module.exports = CLI => {

  CLI.prototype.get = function(key, cb) {
    var that = this;

    if (!key || key == 'all') {
      displayConf((err, data) => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
      });
      return false;
    }
    Configuration.get(key, (err, data) => {
      if (err) {
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }
      // pm2 conf module-name
      if (key.indexOf(':') === -1 && key.indexOf('.') === -1) {
        displayConf(key, () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
        return false;
      }
      // pm2 conf module-name:key
      var module_name, key_name;

      if (key.indexOf(':') > -1) {
        module_name = key.split(':')[0];
        key_name    = key.split(':')[1];
      } else if (key.indexOf('.') > -1) {
        module_name = key.split('.')[0];
        key_name    = key.split('.')[1];
      }

      Common.printOut('Value for module ' + chalk.blue(module_name), 'key ' + chalk.blue(key_name) + ': ' + chalk.bold.green(data));


      return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
    });
  };

  CLI.prototype.set = function(key, value, cb) {
    var that = this;

    if (!key) {
      interactiveConfigEdit(err => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
      });
      return false;
    }

    /**
     * Specific when setting pm2 password
     * Used for restricted remote actions
     * Also alert Interactor that password has been set
     */
    if (key.indexOf('pm2:passwd') > -1) {
      value = Password.generate(value);
      Configuration.set(key, value, err => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        InteractorDaemonizer.launchRPC(that._conf, err => {
          if (err) {
            displayConf('pm2', () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
            return false;
          }
          InteractorDaemonizer.rpc.passwordSet(() => {
            InteractorDaemonizer.disconnectRPC(() => {
              displayConf('pm2', () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
            });
          });
          return false;
        });
      });
      return false;
    }

    /**
     * Set value
     */
    Configuration.set(key, value, err => {
      if (err)
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);

      var values = [];

      if (key.indexOf('.') > -1)
        values = key.split('.');

      if (key.indexOf(':') > -1)
        values = key.split(':');

      if (values && values.length > 1) {
        // The first element is the app name (module_conf.json)
        var app_name = values[0];

        process.env.PM2_PROGRAMMATIC = 'true';
        that.restart(app_name, {
          updateEnv : true
        }, (err, data) => {
          process.env.PM2_PROGRAMMATIC = 'false';
          if (!err)
            Common.printOut(cst.PREFIX_MSG + 'Module %s restarted', app_name);
          displayConf(app_name, () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
        });
        return false;
      }
      displayConf(null, () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
    });
  };

  CLI.prototype.multiset = function(serial, cb) {
    var that = this;

    Configuration.multiset(serial, (err, data) => {
      if (err)
        return cb ? cb({success:false, err:err}) : that.exitCli(cst.ERROR_EXIT);

      var values = [];
      var key = serial.match(/(?:[^ "]+|"[^"]*")+/g)[0];

      if (key.indexOf('.') > -1)
        values = key.split('.');

      if (key.indexOf(':') > -1)
        values = key.split(':');

      if (values && values.length > 1) {
        // The first element is the app name (module_conf.json)
        var app_name = values[0];

        process.env.PM2_PROGRAMMATIC = 'true';
        that.restart(app_name, {
          updateEnv : true
        }, (err, data) => {
          process.env.PM2_PROGRAMMATIC = 'false';
          if (!err)
            Common.printOut(cst.PREFIX_MSG + 'Module %s restarted', app_name);
          displayConf(app_name, () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
        });
        return false;
      }
      displayConf(app_name, () => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));

    });
  };

  CLI.prototype.unset = function(key, cb) {
    var that = this;

    Configuration.unset(key, err => {
      if (err) {
        return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
      }

      displayConf(() => cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT));
    });
  };

  CLI.prototype.conf = function(key, value, cb) {
    var that = this;

    if (typeof(value) === 'function') {
      cb = value;
      value = null;
    }

    // If key + value = set
    if (key && value) {
      that.set(key, value, err => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
      });
    }
    // If only key = get
    else if (key) {
      that.get(key, (err, data) => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
      });
    }
    else {
      interactiveConfigEdit(err => {
        if (err)
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        return cb ? cb(null, {success:true}) : that.exitCli(cst.SUCCESS_EXIT);
      });
    }
  };

};

function interactiveConfigEdit(cb) {
  UX.openEditor(cst.PM2_MODULE_CONF_FILE, (err, data) => {
    Common.printOut(chalk.bold('Module configuration (%s) edited.'), cst.PM2_MODULE_CONF_FILE);
    Common.printOut(chalk.bold('To take changes into account, please restart module related.'), cst.PM2_MODULE_CONF_FILE);
    if (err)
      return cb(Common.retErr(err));
    return cb(null, {success:true});
  });

}

/**
 * Configuration
 */
function displayConf(target_app, cb) {
  if (typeof(target_app) == 'function') {
    cb = target_app;
    target_app = null;
  }

  Configuration.getAll((err, data) => {
    UX.dispKeys(data, target_app);
    return cb();
  });
}
