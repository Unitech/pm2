var cst      = require('../../../constants.js');
var Common   = require('../../Common.js');
var UX       = require('../CliUx');
var chalk    = require('chalk');
var async    = require('async');
var path     = require('path');
var fs       = require('fs');
var KMDaemon = require('../../Interactor/InteractorDaemonizer');
var KM       = require('./kmapi.js');
var Table    = require('cli-table-redemption');
var open     = require('../../tools/open.js');
var promptly = require('promptly');

module.exports = function(CLI) {

  CLI.prototype.openDashboard = function() {
    var that = this;

    KMDaemon.getInteractInfo(this._conf, function(err, data) {
      if (err) {
        Common.printError(chalk.bold.white('Agent if offline, type `$ pm2 register` to log in'));
        return that.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut(chalk.bold('Opening Dashboard in Browser...'));
      open('https://app.keymetrics.io/#/r/' + data.public_key);
      setTimeout(function() {
        that.exitCli();
      }, 200);
    });
  };

  CLI.prototype.loginToKM = function() {
    printMotd();
    return loginPrompt();
  };

  CLI.prototype.registerToKM = function() {
    printMotd();

    promptly.confirm(chalk.bold('Do you have a Keymetrics.io account? (y/n)'), function (err, answer) {
      if (answer == true) {
        return loginPrompt();
      }
      registerPrompt();
    });
  };

  /**
   * Monitor Selectively Processes (auto filter in interaction)
   * @param String state 'monitor' or 'unmonitor'
   * @param String target <pm_id|name|all>
   * @param Function cb callback
   */
  CLI.prototype.monitorState = function(state, target, cb) {
    var that = this;

    if (process.env.NODE_ENV !== 'test') {
      try {
        fs.statSync(this._conf.INTERACTION_CONF);
      } catch(e) {
        printMotd();
        return registerPrompt();
      }
    }

    if (!target) {
      Common.printError(cst.PREFIX_MSG_ERR + 'Please specify an <app_name|pm_id>');
      return cb ? cb(new Error('argument missing')) : that.exitCli(cst.ERROR_EXIT);
    }

    function monitor (pm_id, cb) {
      // State can be monitor or unmonitor
      that.Client.executeRemote(state, pm_id, cb);
    }
    if (target === 'all') {
      that.Client.getAllProcessId(function (err, procs) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        }
        async.forEachLimit(procs, 1, monitor, function (err, res) {
          return typeof cb === 'function' ? cb(err, res) : that.speedList();
        });
      });
    } else if (!Number.isInteger(parseInt(target))) {
      this.Client.getProcessIdByName(target, true, function (err, procs) {
        if (err) {
          Common.printError(err);
          return cb ? cb(Common.retErr(err)) : that.exitCli(cst.ERROR_EXIT);
        }
        async.forEachLimit(procs, 1, monitor, function (err, res) {
          return typeof cb === 'function' ? cb(err, res) : that.speedList();
        });
      });
    } else {
      monitor(parseInt(target), function (err, res) {
        return typeof cb === 'function' ? cb(err, res) : that.speedList();
      });
    }
  };


  /**
   * Private Functions
   */

  function printMotd() {
    var dt = fs.readFileSync(path.join(__dirname, 'motd'));
    console.log(dt.toString());
  }

  function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (re.test(email) == false)
      throw new Error('Not an email');
    return email;
  }

  function validateUsername(value) {
    if (value.length < 6) {
      throw new Error('Min length of 6');
    }
    return value;
  };


  function linkOpenExit(target_bucket) {
    KMDaemon.launchAndInteract(cst, {
      public_key : target_bucket.public_id,
      secret_key : target_bucket.secret_id
    }, function(err, dt) {
      open('https://app.keymetrics.io/#/r/' + target_bucket.public_id);
      setTimeout(function() {
        process.exit(cst.SUCCESS_EXIT);
      }, 100);
    });
  }

  /**
   * Login on Keymetrics
   * Link to the only bucket or list bucket for selection
   * Open Browser
   */
  function loginPrompt(cb) {
    console.log(chalk.bold('Log in to Keymetrics'));
    (function retry() {
      promptly.prompt('Username or Email: ', function(err, username) {
        promptly.password('Password: ', { replace : '*' }, function(err, password) {
          KM.loginAndGetAccessToken({ username : username, password: password }, function(err) {
            if (err) {
              console.error(chalk.red.bold(err) + '\n');
              return retry();
            }
            KM.getBuckets(function(err, buckets) {
              if (err) {
                console.error(chalk.red.bold(err) + '\n');
                return retry();
              }

              if (buckets.length > 1) {
                console.log(chalk.bold('Bucket list'));

                var table = new Table({
                  style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true},
                  head : ['Bucket name', 'Plan type']
                });

                buckets.forEach(function(bucket) {
                  table.push([bucket.name, bucket.credits.offer_type]);
                });

                console.log(table.toString());

                (function retryInsertion() {
                  promptly.prompt('Type the bucket you want to link to: ', function(err, bucket_name) {
                    var target_bucket = null;

                    buckets.some(function(bucket) {
                      if (bucket.name == bucket_name) {
                        target_bucket = bucket;
                        return true;
                      }
                    });

                    if (target_bucket == null)
                      return retryInsertion();
                    linkOpenExit(target_bucket);
                  });
                })();
              }
              else {
                var target_bucket = buckets[0];
                console.log('Connecting local PM2 to Keymetrics Bucket [%s]', target_bucket.name);

                KMDaemon.launchAndInteract(cst, {
                  public_key : target_bucket.public_id,
                  secret_key : target_bucket.secret_id
                }, function(err, dt) {
                  linkOpenExit(target_bucket);
                });
              }
            });
          });

        });
      })
    })()
  }

  /**
   * Register on Keymetrics
   * Create Bucket
   * Auto Link local PM2 to new Bucket
   * Open Browser for access to monitoring dashboard
   */
  function registerPrompt() {
    console.log(chalk.bold('Now registering to Keymetrics'));
    promptly.prompt('Username: ', {
      validator : validateUsername,
      retry : true
    }, function(err, username) {
      promptly.prompt('Email: ', {
        validator : validateEmail,
        retry : true
      }, function(err, email) {
        promptly.password('Password: ', { replace : '*' }, function(err, password) {
          process.stdout.write(chalk.bold('Creating account on Keymetrics..'));
          var inter = setInterval(function() {
            process.stdout.write('.');
          }, 300);
          KM.fullCreationFlow({
            email : email,
            password : password,
            username : username
          }, function(err, target_bucket) {
            clearInterval(inter);
            if (err) {
              console.error('\n' + chalk.red.bold(err) + '\n');
              return registerPrompt();
            }
            linkOpenExit(target_bucket);
          });
        });
      });
    })
  }

};
