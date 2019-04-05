
'use strict'

const cst = require('../../../../constants.js');

const AuthStrategy = require('@pm2/js-api/src/auth_strategies/strategy')
const http = require('http')
const fs = require('fs')
const url = require('url')
const exec = require('child_process').exec
const async = require('async')

module.exports = class WebStrategy extends AuthStrategy {
  // the client will try to call this but we handle this part ourselves
  retrieveTokens (km, cb) {
    this.authenticated = false
    this.callback = cb
    this.km = km
  }

  // so the cli know if we need to tell user to login/register
  isAuthenticated () {
    return new Promise((resolve, reject) => {
      if (this.authenticated) return resolve(true)

      let tokensPath = cst.PM2_IO_ACCESS_TOKEN
      fs.readFile(tokensPath, (err, tokens) => {
        if (err && err.code === 'ENOENT') return resolve(false)
        if (err) return reject(err)

        // verify that the token is valid
        try {
          tokens = JSON.parse(tokens || '{}')
        } catch (err) {
          fs.unlinkSync(tokensPath)
          return resolve(false)
        }

        // if the refresh tokens is here, the user could be automatically authenticated
        return resolve(typeof tokens.refresh_token === 'string')
      })
    })
  }

  // called when we are sure the user asked to be logged in
  _retrieveTokens (optionalCallback) {
    const km = this.km
    const cb = this.callback

    let verifyToken = (refresh) => {
      return km.auth.retrieveToken({
        client_id: this.client_id,
        refresh_token: refresh
      })
    }
    async.tryEach([
      // try to find the token via the environement
      (next) => {
        if (!process.env.PM2_IO_TOKEN) {
          return next(new Error('No token in env'))
        }
        verifyToken(process.env.PM2_IO_TOKEN)
          .then((res) => {
            return next(null, res.data)
          }).catch(next)
      },
      // try to find it in the file system
      (next) => {
        fs.readFile(cst.PM2_IO_ACCESS_TOKEN, (err, tokens) => {
          if (err) return next(err)
          // verify that the token is valid
          tokens = JSON.parse(tokens || '{}')
          if (new Date(tokens.expire_at) > new Date(new Date().toISOString())) {
            return next(null, tokens)
          }

          verifyToken(tokens.refresh_token)
            .then((res) => {
              return next(null, res.data)
            }).catch(next)
        })
      },
      // otherwise make the whole flow
      (next) => {
        return this.loginViaWeb((data) => {
          // verify that the token is valid
          verifyToken(data.access_token)
            .then((res) => {
              return next(null, res.data)
            }).catch(err => next(err))
        })
      }
    ], (err, result) => {
      // if present run the optional callback
      if (typeof optionalCallback === 'function') {
        optionalCallback(err, result)
      }

      if (result.refresh_token) {
        this.authenticated = true
        let file = cst.PM2_IO_ACCESS_TOKEN
        fs.writeFile(file, JSON.stringify(result), () => {
          return cb(err, result)
        })
      } else {
        return cb(err, result)
      }
    })
  }

  loginViaWeb (cb) {
    const redirectURL = `${this.oauth_endpoint}${this.oauth_query}`

    console.log(`${cst.PM2_IO_MSG} Please follow the popup or go to this URL :`, '\n', '    ', redirectURL)

    let shutdown = false
    let server = http.createServer((req, res) => {
      // only handle one request
      if (shutdown === true) return res.end()
      shutdown = true

      let query = url.parse(req.url, true).query

      res.write(`
        <head>
          <script>
          </script>
        </head>
        <body>
          <h2 style="text-align: center">
            You can go back to your terminal now :)
          </h2>
        </body>`)
      res.end()
      server.close()
      return cb(query)
    })
    server.listen(43532, () => {
      this.open(redirectURL)
    })
  }

  deleteTokens (km) {
    return new Promise((resolve, reject) => {
      // revoke the refreshToken
      km.auth.revoke()
        .then(res => {
          // remove the token from the filesystem
          let file = cst.PM2_IO_ACCESS_TOKEN
          fs.unlinkSync(file)
          return resolve(res)
        }).catch(reject)
    })
  }

  open (target, appName, callback) {
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
