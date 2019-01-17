'use strict'

var cst = require('../../../constants.js');
const chalk = require('chalk');
const path = require('path');
const fs  = require('fs');
const Table = require('cli-table-redemption');
const pkg = require('../../../package.json')
const IOAPI = require('@pm2/js-api')
const promptly = require('promptly')
var CLIStrategy = require('./auth-strategies/CliAuth')
var WebStrategy = require('./auth-strategies/WebAuth')
const exec = require('child_process').exec

const OAUTH_CLIENT_ID_WEB = '138558311'
const OAUTH_CLIENT_ID_CLI = '0943857435'

module.exports = class PM2ioHandler {

  static usePM2Client (instance) {
    this.pm2 = instance
  }

  static strategy () {
    switch (process.platform) {
      case 'darwin': {
        return new WebStrategy({
          client_id: OAUTH_CLIENT_ID_WEB
        })
      }
      case 'win32': {
        return new WebStrategy({
          client_id: OAUTH_CLIENT_ID_WEB
        })
      }
      case 'linux': {
        const isDesktop = process.env.XDG_CURRENT_DESKTOP || process.env.XDG_SESSION_DESKTOP || process.env.DISPLAY
        const isSSH = process.env.SSH_TTY || process.env.SSH_CONNECTION
        if (isDesktop && !isSSH) {
          return new WebStrategy({
            client_id: OAUTH_CLIENT_ID_WEB
          })
        } else {
          return new CLIStrategy({
            client_id: OAUTH_CLIENT_ID_CLI
          })
        }
      }
      default: {
        return new CLIStrategy({
          client_id: OAUTH_CLIENT_ID_CLI
        })
      }
    }
  }

  static init () {
    this._strategy = this.strategy()
    /**
     * If you are using a local backend you should give those options :
     * {
     *   services: {
     *    API: 'http://localhost:3000',
     *    OAUTH: 'http://localhost:3100'
     *   }
     *  }
     */
    this.io = new IOAPI().use(this._strategy)
  }

  static launch (command, opts) {
    // first init the strategy and the io client
    this.init()

    switch (command) {
      case 'connect' :
      case 'login' :
      case 'register' :
      case undefined :
      case 'authenticate' : {
        this.authenticate()
        break
      }
      case 'validate' : {
        this.validateAccount(opts)
        break
      }
      case 'help' :
      case 'welcome': {
        var dt = fs.readFileSync(path.join(__dirname, './pres/welcome'));
        console.log(dt.toString());
        return process.exit(0)
      }
      case 'logout': {
        this._strategy.isAuthenticated().then(isConnected => {
          // try to kill the agent anyway
          this.pm2.killAgent(err => {})

          if (isConnected === false) {
            console.log(`${cst.PM2_IO_MSG} Already disconnected`)
            return process.exit(0)
          }

          this._strategy._retrieveTokens((err, tokens) => {
            if (err) {
              console.log(`${cst.PM2_IO_MSG} Successfully disconnected`)
              return process.exit(0)
            }
            this._strategy.deleteTokens(this.io).then(_ => {
              console.log(`${cst.PM2_IO_MSG} Successfully disconnected`)
              return process.exit(0)
            }).catch(err => {
              console.log(`${cst.PM2_IO_MSG_ERR} Unexpected error: ${err.message}`)
              return process.exit(1)
            })
          })
        }).catch(err => {
          console.error(`${cst.PM2_IO_MSG_ERR} Failed to logout: ${err.message}`)
          console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
        })
        break
      }
      case 'create': {
        this._strategy.isAuthenticated().then(res => {
          // if the user isn't authenticated, we make them do the whole flow
          if (res !== true) {
            this.authenticate()
          } else {
            this.createBucket(this.createBucketHandler)
          }
        }).catch(err => {
          console.error(`${cst.PM2_IO_MSG_ERR} Failed to create to the bucket: ${err.message}`)
          console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
        })
        break
      }
      case 'web': {
        this._strategy.isAuthenticated().then(res => {
          // if the user isn't authenticated, we make them do the whole flow
          if (res === false) {
            console.error(`${cst.PM2_IO_MSG_ERR} You need to be authenticated to do that, please use: pm2 plus login`)
            return process.exit(1)
          }
          this._strategy._retrieveTokens(() => {
            return this.openUI()
          })
        }).catch(err => {
          console.error(`${cst.PM2_IO_MSG_ERR} Failed to open the UI: ${err.message}`)
          console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
        })
        break
      }
      default : {
        console.log(`${cst.PM2_IO_MSG_ERR} Invalid command ${command}, available : login,register,validate,connect or web`)
        process.exit(1)
      }
    }
  }

  static openUI () {
    this.io.bucket.retrieveAll().then(res => {
      const buckets = res.data

      if (buckets.length === 0) {
        return this.createBucket((err, bucket) => {
          if (err) {
            console.error(`${cst.PM2_IO_MSG_ERR} Failed to connect to the bucket: ${err.message}`)
            if (bucket) {
              console.error(`${cst.PM2_IO_MSG_ERR} You can retry using: pm2 plus link ${bucket.secret_id} ${bucket.public_id}`)
            }
            console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
            return process.exit(0)
          }
          const targetURL = `https://app.pm2.io/#/bucket/${bucket._id}`
          console.log(`${cst.PM2_IO_MSG} Please follow the popup or go to this URL :`, '\n', '    ', targetURL)
          open(targetURL)
          return process.exit(0)
        })
      }

      var table = new Table({
        style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true},
        head : ['Bucket name', 'Plan type']
      })

      buckets.forEach(function(bucket) {
        table.push([bucket.name, bucket.credits.offer_type])
      })
      console.log(table.toString())
      console.log(`${cst.PM2_IO_MSG} If you don't want to open the UI to a bucket, type 'none'`)

      const choices = buckets.map(bucket => bucket.name)
      choices.push('none')

      promptly.choose(`${cst.PM2_IO_MSG} Type the name of the bucket you want to connect to :`, choices, (err, value) => {
        if (value === 'none') process.exit(0)

        const bucket = buckets.find(bucket => bucket.name === value)
        if (bucket === undefined) return process.exit(0)

        const targetURL = `https://app.pm2.io/#/bucket/${bucket._id}`
        console.log(`${cst.PM2_IO_MSG} Please follow the popup or go to this URL :`, '\n', '    ', targetURL)
        this.open(targetURL)
        return process.exit(0)
      })
    })
  }

  static validateAccount (token) {
    this.io.auth.validEmail(token)
      .then(res => {
        console.log(`${cst.PM2_IO_MSG} Email succesfully validated.`)
        console.log(`${cst.PM2_IO_MSG} You can now proceed and use: pm2 plus connect`)
        return process.exit(0)
      }).catch(err => {
        if (err.status === 401) {
          console.error(`${cst.PM2_IO_MSG_ERR} Invalid token`)
          return process.exit(1)
        } else if (err.status === 301) {
          console.log(`${cst.PM2_IO_MSG} Email succesfully validated.`)
          console.log(`${cst.PM2_IO_MSG} You can now proceed and use: pm2 plus connect`)
          return process.exit(0)
        }
        const msg = err.data ? err.data.error_description || err.data.msg : err.message
        console.error(`${cst.PM2_IO_MSG_ERR} Failed to validate your email: ${msg}`)
        console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
        return process.exit(1)
      })
  }

  static createBucketHandler (err, bucket) {
    if (err) {
      console.error(`${cst.PM2_IO_MSG_ERR} Failed to connect to the bucket: ${err.message}`)
      if (bucket) {
        console.error(`${cst.PM2_IO_MSG_ERR} You can retry using: pm2 plus link ${bucket.secret_id} ${bucket.public_id}`)
      }
      console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
      return process.exit(0)
    }
    if (bucket === undefined) {
      return process.exit(0)
    }
    console.log(`${cst.PM2_IO_MSG} Successfully connected to bucket ${bucket.name}`)
    console.log(`${cst.PM2_IO_MSG} You can use the web interface over there: https://app.pm2.io/#/bucket/${bucket._id}`)
    return process.exit(0)
  }

  static createBucket (cb) {
    console.log(`${cst.PM2_IO_MSG} It seems that you don't have any bucket to monitor your app currently.`)
    console.log(`${cst.PM2_IO_MSG} Note: A bucket is like a organization in PM2 Plus where you connect multiples servers to it.`)
    console.log(`${cst.PM2_IO_MSG} By default we allow you to trial PM2 Plus for 14 days without any credit card.`)
    // do not create a bucket by default, we need their authorization
    promptly.confirm(`${cst.PM2_IO_MSG} Do you want to create a new bucket and launch the trial ? (y/n)`, (err, value) => {
      if (err || value === false) {
        console.log(`${cst.PM2_IO_MSG} Okay, you can create one anytime (only one trial per account is allowed thought) by using: pm2 plus create`)
        return process.exit(0)
      }

      this.io.bucket.create({
        name: 'PM2 Plus Monitoring'
      }).then(res => {
        const bucket = res.data
        this.io.bucket.billing.startTrial(bucket._id, {
          plan: 'plus_8'
        }).then(res => {
          console.log(`${cst.PM2_IO_MSG} Successfully created the bucket`)
          this.pm2.link({
            public_key: bucket.public_id,
            secret_key: bucket.secret_id,
            pm2_version: pkg.version
          }, (err) => {
            if (err) {
              return cb(new Error('Failed to connect your local PM2 to your bucket'), bucket)
            } else {
              return cb(null, bucket)
            }
          })
        }).catch(err => {
          return cb(new Error(`Failed to enable the trial: ${err.message}`))
        })
      }).catch(err => {
        return cb(new Error(`Failed to create a bucket: ${err.message}`))
      })
    })
  }

  /**
   * Connect the local agent to a specific bucket
   * @param {Function} cb
   */
  static connectToBucket (cb) {
    this.io.bucket.retrieveAll().then(res => {
      const buckets = res.data

      if (buckets.length === 0) {
        return this.createBucket(cb)
      }

      var table = new Table({
        style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true},
        head : ['Bucket name', 'Plan type']
      })

      buckets.forEach(function(bucket) {
        table.push([bucket.name, bucket.credits.offer_type])
      })
      console.log(table.toString())
      console.log(`${cst.PM2_IO_MSG} If you don't want to connect to a bucket, type 'none'`)

      const choices = buckets.map(bucket => bucket.name)
      choices.push('none')

      promptly.choose(`${cst.PM2_IO_MSG} Type the name of the bucket you want to connect to :`, choices, (err, value) => {
        if (value === 'none') return cb()

        const bucket = buckets.find(bucket => bucket.name === value)
        if (bucket === undefined) return cb()
        this.pm2.link({
          public_key: bucket.public_id,
          secret_key: bucket.secret_id,
          pm2_version: pkg.version
        }, (err) => {
          return err ? cb(err) : cb(null, bucket)
        })
      })
    })
  }

  /**
   * Authenticate the user with either of the strategy
   * @param {Function} cb
   */
  static authenticate () {
    this._strategy._retrieveTokens((err, tokens) => {
      if (err) {
        const msg = err.data ? err.data.error_description || err.data.msg : err.message
        console.log(`${cst.PM2_IO_MSG_ERR} Unexpected error : ${msg}`)
        return process.exit(1)
      }
      console.log(`${cst.PM2_IO_MSG} Successfully authenticated`)
      this.io.user.retrieve().then(res => {
        const user = res.data

        if (typeof user.email_token === 'string') {
          console.log(`${cst.PM2_IO_MSG} You need to validate your email, you should have received an email at ${user.email}`)
          console.log(`${cst.PM2_IO_MSG} You can also contact us to get help: contact@pm2.io`)
          process.stdout.write(`${cst.PM2_IO_MSG} Waiting for validation `)
          const interval = setInterval(() => {
            this.io.user.retrieve().then(res => {
              const tmpUser = res.data
              if (tmpUser.email_token === null) {
                console.log(`\n${cst.PM2_IO_MSG} Successfully validated`)
                clearInterval(interval)
                this.connectToBucket(this.createBucketHandler)
              } else {
                process.stdout.write('.')
              }
            })
          }, 2000)
        } else {
          this.connectToBucket(this.createBucketHandler)
        }
      })
    })
  }

  static open (target, appName, callback) {
    let opener
    const escape = function (s) {
      return s.replace(/"/g, '\\"')
    }

    if (typeof (appName) === 'function') {
      callback = appName
      appName = null
    }

    switch (process.platform) {
      case 'darwin': {
        opener = appName ? `open -a "${escape(appName)}"` : `open`
        break
      }
      case 'win32': {
        opener = appName ? `start "" ${escape(appName)}"` : `start ""`
        break
      }
      default: {
        opener = appName ? escape(appName) : `xdg-open`
        break
      }
    }

    if (process.env.SUDO_USER) {
      opener = 'sudo -u ' + process.env.SUDO_USER + ' ' + opener
    }
    return exec(`${opener} "${escape(target)}"`, callback)
  }
}
