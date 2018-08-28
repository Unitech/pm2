'use strict'

var cst = require('../../../constants.js');
const chalk = require('chalk');
const path = require('path');
const fs  = require('fs');
const Table = require('cli-table-redemption');
const pkg = require('../../../package.json')
const IOAPI = require('@pm2/js-api')
const promptly = require('promptly')

var CLIAuthStrategy
var io

module.exports = function(CLI) {

  function initializeConnection() {
    // const CustomStrategy = require('./custom_auth')
    // const strategy = new CustomStrategy({
    //   client_id: '7412235273'
    // })

    const CLIAuth = require('./auth-strategies/CliAuth')
    CLIAuthStrategy = new CLIAuth({
      client_id: '938758711'
    })

    io = new IOAPI().use(CLIAuthStrategy)
  }

  /**
   * CLI LOGIN
   */
  CLI.prototype.login = function(cb) {
    var self = this

    initializeConnection()

    return CLIAuthStrategy._retrieveTokens((err, tokens) => {
      if (err) {
        console.error(cst.PM2_IO_MSG_ERR + `Error: ${err}`)
        process.exit(1)
      }

      // query both the user and all bucket
      Promise.all([ io.user.retrieve(), io.bucket.retrieveAll() ])
        .then(results => {
          let user = results[0].data
          let buckets = results[1].data

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

                if (target_bucket == null) {
                  return retryInsertion();
                }

                var connection_info = {
                  public_key: target_bucket.public_id,
                  secret_key: target_bucket.secret_id,
                  pm2_version: pkg.version
                }

                return self.link(connection_info, function(err, endpoints) {
                  cb(err, target_bucket)
                });
              });
            })();
        }).catch(err => {
          console.error(cst.PM2_IO_MSG_ERR + `Error: ${err}`)
          return process.exit(1)
        })
    })
  };

  /**
   * CLI REGISTER
   */
  CLI.prototype.register = function(opts) {
    const self = this

    initializeConnection()
    printMotd();

    function finalize(bucket) {
      if (bucket.type === 'enterprise')
        opts.type = 'enterprise'
      else if (bucket._payment.offer_type.indexOf('pro') > -1)
        opts.type = 'plus'

      //self.minimumSetup(opts, () => {
        console.log()
        console.log(chalk.green('[+] PM2 Plus has been successfully enabled!'))

        console.log(cst.PM2_IO_MSG + 'Access to the remote dashboard: https://app.pm2.io/#/r/' + bucket.public_id);

        setTimeout(function() {
          process.exit(cst.SUCCESS_EXIT);
        }, 200)
      //})
    }

    promptly.confirm(chalk.bold('Do you have a pm2.io account? (y/n)'), (err, answer) => {

      // Login
      if (answer == true) {
        return self.login((err, bucket) => {
          if (err) {
            console.error(err)
            return process.exit(1)
          }

          self.gl_is_km_linked = true
          finalize(bucket)
        });
      }

      // Register
      CLIAuthStrategy.registerViaCLI((err, data) => {
        console.log('[-] Creating Bucket...')

        io.bucket.create({
          name: 'Node.JS Monitoring'
        }).then(res => {
          const bucket = res.data.bucket
          console.log(chalk.bold.green('[+] Bucket created!'))

          var connection_info = {
            public_key: bucket.public_id,
            secret_key: bucket.secret_id,
            pm2_version: pkg.version
          }

          self.link(connection_info, () => {
            finalize(bucket)
          })
        })
      })
    });
  }

  /**
   * CLI LOGOUT
   */
  CLI.prototype.logout = function () {
    initializeConnection()

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

  /**
   * Private Functions
   */
  function printMotd() {
    var dt = fs.readFileSync(path.join(__dirname, './pres/motd'));
    console.log(dt.toString());
  }
};
