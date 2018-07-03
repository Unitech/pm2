'use strict'

var cst = require('../../../constants.js');
var Common = require('../../Common.js');
var KMDaemon = require('@pm2/agent/src/InteractorClient');

const chalk = require('chalk');
const async = require('async');
const path = require('path');
const fs  = require('fs');
const Table = require('cli-table-redemption');
const open = require('../../tools/open.js');
const pkg = require('../../../package.json')
const IOAPI = require('@pm2/js-api')


// const CustomStrategy = require('./custom_auth')
// const strategy = new CustomStrategy({
//   client_id: '7412235273'
// })

const CLIAuth = require('./CliAuth')

const CLIAuthStrategy = new CLIAuth({
  client_id: '938758711'
})

const io = new IOAPI().use(CLIAuthStrategy)

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
        this.exitCli();
      }, 200);
    });
  };

  CLI.prototype.loginToKM = function() {
    var promptly = require('promptly')
    printMotd();

    return CLIAuthStrategy._retrieveTokens((err, tokens) => {
      if (err) {
        console.error(`Oups, a error happened : ${err}`)
        process.exit(1)
      }

      // query both the user and all bucket
      Promise.all([ io.user.retrieve(), io.bucket.retrieveAll() ])
        .then(results => {
          let user = results[0].data
          let buckets = results[1].data

          if (buckets.length > 1) {
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
            linkOpenExit(target_bucket)
          }
        }).catch(err => {
          console.error(chalk.bold.red(`Oups, a error happened : ${err}`))
          return process.exit(1)
        })
    })
  };

  CLI.prototype.registerToKM = function() {
    var promptly = require('promptly');

    promptly.confirm(chalk.bold('Do you have a pm2.io account? (y/n)'), (err, answer) => {
      if (answer == true) {
        return this.loginToKM();
      }
      CLIAuthStrategy.registerViaCLI((err, data) => {
        console.log('[-] Creating Bucket...')

        io.bucket.create({
          name: 'Node.JS Monitoring'
        }).then(res => {
          const bucket = res.data.bucket
          console.log(chalk.bold.green('[+] Bucket created!'))
          linkOpenExit(bucket)
        })
      })
    });
  }

  CLI.prototype.logoutToKM = function () {
    CLIAuthStrategy._retrieveTokens(_ => {
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

  CLI.prototype.connectToPM2IO = function() {
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
        return this.registerToKM();
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


  function linkOpenExit(target_bucket) {
    console.log('[-] Linking local PM2 to newly created bucket...')
    KMDaemon.launchAndInteract(cst, {
      public_key : target_bucket.public_id,
      secret_key : target_bucket.secret_id,
      pm2_version: pkg.version
    }, function(err, dt) {
      console.log(chalk.bold.green('[+] Local PM2 Connected!'))

      console.log('[-] Opening Monitoring Interface in Browser...')

      setTimeout(function() {
        open('https://app.pm2.io/#/r/' + target_bucket.public_id);
        console.log(chalk.bold.green('[+] Opened! Exiting now.'))
        setTimeout(function() {
          process.exit(cst.SUCCESS_EXIT);
        }, 100);
      }, 1000)
    });
  }

  /**
   * Private Functions
   */
  function printMotd() {
    var dt = fs.readFileSync(path.join(__dirname, 'motd'));
    console.log(dt.toString());
  }
};
