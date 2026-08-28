// #6006 #6016 #5747 #5622 #5030 #5032 #4943 #4778 #4821 #3210
// Shell env vars named like a PM2 option must not override the app config

process.chdir(__dirname)

process.env.name = 'from-shell'
process.env.namespace = 'shell-ns'
process.env.cron_restart = '* * * * *'
process.env.instances = '8'
process.env.exec_mode = 'cluster'
process.env.CUSTOM_VAR = 'kept'

var PM2 = require('../..')
var should = require('should')

describe('Env vars vs PM2 config', function() {
  before(function(done) {
    PM2.delete('all', function() { done() })
  })

  after(function(done) {
    PM2.kill(done)
  })

  afterEach(function(done) {
    PM2.delete('all', done)
  })

  it('should not override config with shell env vars', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'my-app'
    }, function(err) {
      should(err).be.null()
      PM2.list(function(err, list) {
        should(err).be.null()
        should(list.length).eql(1)
        var env = list[0].pm2_env
        should(env.name).eql('my-app')
        should(env.namespace).eql('default')
        should(env.cron_restart).be.undefined()
        should(env.instances).eql(1)
        should(env.exec_mode).eql('fork_mode')
        // regular env vars are still flattened and exported
        should(env.CUSTOM_VAR).eql('kept')
        done()
      })
    })
  })

  it('should still apply env vars on restart --update-env', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'my-app',
      env: { CUSTOM_VAR: 'v1' }
    }, function(err) {
      should(err).be.null()
      process.env.CUSTOM_VAR = 'v2'
      PM2.restart('my-app', { updateEnv: true }, function(err) {
        should(err).be.null()
        PM2.list(function(err, list) {
          should(err).be.null()
          should(list[0].pm2_env.CUSTOM_VAR).eql('v2')
          should(list[0].pm2_env.name).eql('my-app')
          done()
        })
      })
    })
  })
})
