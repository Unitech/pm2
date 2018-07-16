

'use strict'

const AuthStrategy = require('@pm2/js-api/src/auth_strategies/strategy')

const http = require('http')
const fs = require('fs')
const url = require('url')
const exec = require('child_process').exec
const async = require('async')
const path = require('path')
const os = require('os')
const needle = require('needle');
const chalk = require('chalk')
const cst = require('../../../../constants.js');

module.exports = class CustomStrategy extends AuthStrategy {
  // the client will try to call this but we handle this part ourselves
  retrieveTokens (km, cb) {
    this.authenticated = false
    this.callback = cb
    this.km = km
    this.BASE_URI = 'https://app.keymetrics.io';
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

    async.tryEach([
      // try to find the token via the environement
      (next) => {
        if (!process.env.KM_TOKEN) {
          return next(new Error('No token in env'))
        }
        this.verifyToken(process.env.KM_TOKEN)
          .then((res) => {
            return next(null, res.data)
          }).catch(next)
      },
      // try to find it in the file system
      (next) => {
        return next(new Error('nope'))

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
        return this.loginViaCLI((data) => {
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

  loginViaCLI (cb) {
    var promptly = require('promptly');

    let retry = () => {
      promptly.prompt('Username or Email: ', (err, username) => {
        if (err) return retry();

        promptly.password('Password: ', { replace : '*' }, (err, password) => {
          if (err) return retry();

          this._loginUser({
            username: username,
            password: password
          }, (err, data) => {
            if (err) return retry()
            cb(data)
          })
        })
      })
    }

    retry()
  }

  _loginUser (user_info, cb) {
    const querystring = require('querystring');
    const AUTH_URI = 'https://id.keymetrics.io'
    const URL_AUTH = '/api/oauth/authorize?response_type=token&scope=all&client_id=' +
            this.client_id + '&redirect_uri=https://app.keymetrics.io';

    console.log(chalk.bold('[-] Logging to pm2.io'))

    needle.get(AUTH_URI + URL_AUTH, (err, res) => {
      if (err) return cb(err);

      var cookie = res.cookies;

      needle.post(AUTH_URI + '/api/oauth/login', user_info, {
        cookies : cookie
      }, (err, resp, body) => {
        if (err) return cb(err);
        if (resp.statusCode != 200) return cb('Wrong credentials');

        var location = resp.headers['x-redirect'];
        var redirect = AUTH_URI + location;

        needle.get(redirect, {
          cookies : cookie
        }, (err, res) => {
          if (err) return cb(err);
          var refresh_token = querystring.parse(url.parse(res.headers.location).query).access_token;
          needle.post(AUTH_URI + '/api/oauth/token', {
            client_id : this.client_id,
            grant_type : 'refresh_token',
            refresh_token : refresh_token,
            scope : 'all'
          }, (err, res, body) => {
            if (err) return cb(err);
            console.log(chalk.bold.green('[+] Logged in!'))
            return cb(null, body);
          })
        });
      });
    });
  }

  registerViaCLI (cb) {
    var promptly = require('promptly');
    console.log(chalk.bold('[-] Registering to pm2.io'));

    var retry = () => {
      promptly.prompt('Username: ', {
        validator : this._validateUsername,
        retry : true
      }, (err, username) => {
        promptly.prompt('Email: ', {
          validator : this._validateEmail,
          retry : true
        },(err, email) => {
          promptly.password('Password: ', { replace : '*' }, (err, password) => {
            process.stdout.write('Creating account on pm2.io...');

            var inter = setInterval(function() {
              process.stdout.write('.');
            }, 200);

            this._registerUser({
              email : email,
              password : password,
              username : username
            }, (err, data) => {
              clearInterval(inter)
              if (err) {
                console.error()
                console.error(chalk.bold.red(err));
                return retry()
              }
              console.log(chalk.green.bold('\n[+] Account created!'))

              this._loginUser({
                username: username,
                password: password
              }, (err, data) => {
                this.callback(err, data)
                return cb(err, data)
              })
            })
          });
        });
      })
    }
    retry();
  }

  /**
   * Register function
   * @param user_info.username
   * @param user_info.password
   * @param user_info.email
   */
  _registerUser (user_info, cb) {
    needle.post(this.BASE_URI + '/api/oauth/register', user_info, {
      json: true,
      headers: {
        'X-Register-Provider': 'pm2-register'
      }
    }, function (err, res, body) {
      if (err) return cb(err);
      if (body.email && body.email.message) return cb(body.email.message);
      if (body.username && body.username.message) return cb(body.username.message);
      if (!body.access_token) return cb(body.msg)

      cb(null, {
        token : body.refresh_token.token
      })
    });
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
