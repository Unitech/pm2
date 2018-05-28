'use strict'

var cst = require('../../../constants.js');
var Common = require('../../Common.js');
var chalk = require('chalk');
var async = require('async');
var path = require('path');
var fs  = require('fs');
var KMDaemon = require('@pm2/agent/src/InteractorClient');
var Table = require('cli-table-redemption');
const pkg = require('../../../package.json')
const IOAPI = require('@pm2/js-api')
const CustomStrategy = require('./custom_auth')
const strategy = new CustomStrategy({
  client_id: '7412235273'
})
const io = new IOAPI().use(strategy)


module.exports = function(CLI) {

  CLI.prototype.openDashboard = function() {
    KMDaemon.getInteractInfo(this._conf, (err, data) => {
      if (err) {
        Common.printError(chalk.bold.white('Agent if offline, type `$ pm2 register` to log in'));
        return this.exitCli(cst.ERROR_EXIT);
      }
      Common.printOut(chalk.bold('Opening Dashboard in Browser...'));
      open('https://app.pm2.io/#/r/' + data.public_key);
      setTimeout(_ => {
        exitCli();
      }, 200);
    });
  };

  CLI.prototype.loginToKM = function() {
    printMotd();
    console.log(`
    Hello !

    You will be redirected to our platform to login, you can login using Github/Google if you want !
    `)

    return setTimeout(_ => {
      return strategy._retrieveTokens((err, tokens) => {
        if (err) {
          console.error(`Oups, a error happened : ${err.message}`)
          process.exit(1)
        }
        // query both the user and all bucket
        Promise.all([ io.user.retrieve(), io.bucket.retrieveAll() ])
          .then(results => {
            let user = results[0].data
            console.log(`You succesfully logged as ${user.username} !`)
            console.log(`You can logout if you want by running :
               $ pm2 logout
              `)
            let buckets = results[1].data
            if (buckets.length > 0) {
              console.log(`You have access to ${buckets.length} buckets !`)
              return process.exit(0)
            }
            // we will create one if he doesnt have one already
            console.log(`It seems that you dont have any bucket to link your pm2 to, we will create one for you ..`)
            io.bucket.create({
              name: 'Node.JS Monitoring'
            }).then(res => {
              const bucket = res.data.bucket
              console.log(`Succesfully created a bucket !`)
              console.log(`To start using it, you should push data with :
                pm2 link ${bucket.secret_id} ${bucket.public_id}
              `)
              console.log(`You can also access our dedicated UI by going here :
                https://app.pm2.io/#/r/${bucket.public_id}
              `)

              KMDaemon.launchAndInteract(cst, {
                public_key : bucket.public_id,
                secret_key : bucket.secret_id
              }, function(err, dt) {
                open(`https://app.pm2.io/#/r/${bucket.public_id}`);
                setTimeout(_ => {
                  return process.exit(0)
                }, 200)
              });
              
            })
          }).catch(err => {
            console.error(`Oups, a error happened : ${err.message}`)
            return process.exit(1)
          })
      })
    }, 1000)
  };

  CLI.prototype.registerToKM = CLI.prototype.loginToKM


  CLI.prototype.logoutToKM = function () {
    strategy._retrieveTokens(_ => {
      io.auth.logout()
      .then(res => {
        console.log(`- Logout successful`)
        return process.exit(0)
      }).catch(err => {
        console.error(`Oups, a error happened : ${err.message}`)
        return process.exit(1)
      })
    })
  }

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
};
