

'use strict'

const AuthStrategy = require('@pm2/js-api/src/auth_strategies/strategy')
const querystring = require('querystring');

const http = require('http')
const fs = require('fs')
const url = require('url')
const exec = require('child_process').exec
const tryEach = require('async/tryEach')
const path = require('path')
const os = require('os')
const needle = require('needle')
const chalk = require('chalk')
const cst = require('../../../../constants.js')
const promptly = require('promptly')

module.exports = class CliStrategy extends AuthStrategy {
  // the client will try to call this but we handle this part ourselves
  retrieveTokens (km, cb) {
    this.authenticated = false
    this.callback = cb
    this.km = km
    this.BASE_URI = 'https://id.keymetrics.io';
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

  verifyToken (refresh) {
    return this.km.auth.retrieveToken({
      client_id: this.client_id,
      refresh_token: refresh
    })
  }

  // called when we are sure the user asked to be logged in
  _retrieveTokens (optionalCallback) {
    const km = this.km
    const cb = this.callback

    tryEach([
      // try to find the token via the environement
      (next) => {
        if (!process.env.PM2_IO_TOKEN) {
          return next(new Error('No token in env'))
        }
        this.verifyToken(process.env.PM2_IO_TOKEN)
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

          this.verifyToken(tokens.refresh_token)
            .then((res) => {
              return next(null, res.data)
            }).catch(next)
        })
      },
      // otherwise make the whole flow
      (next) => {
        return this.authenticate((err, data) => {
          if (err instanceof Error) return next(err)
          // verify that the token is valid
          this.verifyToken(data.refresh_token)
            .then((res) => {
              return next(null, res.data)
            }).catch(next)
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

  authenticate (cb) {
    console.log(`${cst.PM2_IO_MSG} Using non-browser authentication.`)
    promptly.confirm(`${cst.PM2_IO_MSG} Do you have a pm2.io account? (y/n)`, (err, answer) => {
      // Either login or register
      return answer === true ? this.login(cb) : this.register(cb)
    })
  }

  login (cb) {
    let retry = () => {
      promptly.prompt(`${cst.PM2_IO_MSG} Your username or email: `, (err, username) => {
        if (err) return retry();

        promptly.password(`${cst.PM2_IO_MSG} Your password: `, { replace : '*' }, (err, password) => {
          if (err) return retry();

          console.log(`${cst.PM2_IO_MSG} Authenticating ...`)
          this._loginUser({
            username: username,
            password: password
          }, (err, data) => {
            if (err) {
              console.error(`${cst.PM2_IO_MSG_ERR} Failed to authenticate: ${err.message}`)
              return retry()
            }
            return cb(null, data)
          })
        })
      })
    }

    retry()
  }

  register (cb) {
    console.log(`${cst.PM2_IO_MSG} No problem ! We just need few informations to create your account`)

    var retry = () => {
      promptly.prompt(`${cst.PM2_IO_MSG} Please choose an username :`, {
        validator : this._validateUsername,
        retry : true
      }, (err, username) => {
        promptly.prompt(`${cst.PM2_IO_MSG} Please choose an email :`, {
          validator : this._validateEmail,
          retry : true
        },(err, email) => {
          promptly.password(`${cst.PM2_IO_MSG} Please choose a password :`, { replace : '*' }, (err, password) => {
            promptly.confirm(`${cst.PM2_IO_MSG} Do you accept the terms and privacy policy (https://pm2.io/legals/terms_conditions.pdf) ?  (y/n)`, (err, answer) => {
              if (err) {
                console.error(chalk.bold.red(err));
                return retry()
              } else if (answer === false) {
                console.error(`${cst.PM2_IO_MSG_ERR} You must accept the terms and privacy policy to contiue.`)
                return retry()
              }

              this._registerUser({
                email : email,
                password : password,
                username : username
              }, (err, data) => {
                console.log('\n')
                if (err) {
                  console.error(`${cst.PM2_IO_MSG_ERR} Unexpect error: ${err.message}`)
                  console.error(`${cst.PM2_IO_MSG_ERR} You can also contact us to get help: contact@pm2.io`)
                  return process.exit(1)
                }
                return cb(undefined, data)
              })
            })
          })
        })
      })
    }
    retry()
  }

  /**
   * Register function
   * @param opts.username
   * @param opts.password
   * @param opts.email
   */
  _registerUser (opts, cb) {
    const data = Object.assign(opts, {
      password_confirmation: opts.password,
      accept_terms: true
    })
    needle.post(this.BASE_URI + '/api/oauth/register', data, {
      json: true,
      headers: {
        'X-Register-Provider': 'pm2-register',
        'x-client-id': this.client_id
      }
    }, function (err, res, body) {
      if (err) return cb(err)
      if (body.email && body.email.message) return cb(new Error(body.email.message))
      if (body.username && body.username.message) return cb(new Error(body.username.message))
      if (!body.access_token) return cb(new Error(body.msg))

      return cb(null, {
        refresh_token : body.refresh_token.token,
        access_token : body.access_token.token
      })
    });
  }

  _loginUser (user_info, cb) {
    const URL_AUTH = '/api/oauth/authorize?response_type=token&scope=all&client_id=' +
            this.client_id + '&redirect_uri=http://localhost:43532';

    needle.get(this.BASE_URI + URL_AUTH, (err, res) => {
      if (err) return cb(err);

      var cookie = res.cookies;

      needle.post(this.BASE_URI + '/api/oauth/login', user_info, {
        cookies : cookie
      }, (err, resp, body) => {
        if (err) return cb(err)
        if (resp.statusCode != 200) return cb('Wrong credentials')

        var location = resp.headers['x-redirect']

        needle.get(this.BASE_URI + location, {
          cookies : cookie
        }, (err, res) => {
          if (err) return cb(err);
          var refresh_token = querystring.parse(url.parse(res.headers.location).query).access_token;
          needle.post(this.BASE_URI + '/api/oauth/token', {
            client_id : this.client_id,
            grant_type : 'refresh_token',
            refresh_token : refresh_token,
            scope : 'all'
          }, (err, res, body) => {
            if (err) return cb(err)
            return cb(null, body)
          })
        })
      })
    })
  }

  _validateEmail (email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (re.test(email) == false)
      throw new Error('Not an email');
    return email;
  }

  _validateUsername (value) {
    if (value.length < 6) {
      throw new Error('Min length of 6');
    }
    return value;
  };

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
}
