// #6006 #6016 #5747 #5622 #5030 #5032 #4943 #4778 #4821 #3210
// Shell env vars named like a PM2 option must not override the app config

process.chdir(__dirname)

process.env.name = 'from-shell'
process.env.namespace = 'shell-ns'
process.env.cron_restart = '* * * * *'
process.env.instances = '8'
process.env.exec_mode = 'cluster'
process.env.CUSTOM_VAR = 'kept'
// set before the daemon is spawned so it inherits them too: in cluster mode
// the worker starts from the daemon env, so a leak shows up there
process.env.port = '9999'
process.env.time = 'from-shell'

var PM2 = require('../..')
var should = require('should')
var fs = require('fs')
var os = require('os')
var path = require('path')

var DUMP = path.join(os.tmpdir(), 'pm2-env-dump-' + process.pid + '.json')

/**
 * Start an app that writes its own process.env to DUMP, and resolve with it.
 */
function startAndReadEnv(opts) {
  return new Promise(function(resolve, reject) {
    try { fs.unlinkSync(DUMP) } catch (e) {}

    opts.script = './../fixtures/dump-env.js'
    opts.env = Object.assign({ ENV_DUMP_FILE: DUMP }, opts.env)

    PM2.start(opts, function(err) {
      if (err) return reject(err)

      var tries = 0
      ;(function wait() {
        if (fs.existsSync(DUMP))
          return resolve(JSON.parse(fs.readFileSync(DUMP, 'utf8')))
        if (++tries > 50)
          return reject(new Error('app never dumped its environment'))
        setTimeout(wait, 100)
      })()
    })
  })
}

describe('Env vars vs PM2 config', function() {
  before(function(done) {
    PM2.delete('all', function() { done() })
  })

  after(function(done) {
    try { fs.unlinkSync(DUMP) } catch (e) {}
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

  // The filter that stops shell env vars from clobbering config must not also
  // swallow the same keys when the user declares them in `env:`.
  // `env: { port: 3000 }` is a common pattern.
  it('should pass ecosystem env vars named like PM2 options to the app', async function() {
    var env = await startAndReadEnv({
      name: 'my-app',
      env: { port: '3000', time: 'zzz' }
    })
    should(env.port).eql('3000')
    should(env.time).eql('zzz')
  })

  it('should rank ecosystem env above shell env, and config above both', async function() {
    var env = await startAndReadEnv({
      name: 'my-app',
      env: { port: '3000' }
    })
    // declared env beats the shell's port=9999
    should(env.port).eql('3000')
    // config still beats the shell's name=from-shell
    should(env.name).eql('my-app')
  })

  // Cluster workers inherit the daemon env and are then overwritten from
  // pm2_env, so a dropped key leaves the shell value in place instead of
  // leaving it undefined. Separate code path, separate failure.
  it('should pass ecosystem env vars named like PM2 options in cluster mode', async function() {
    var env = await startAndReadEnv({
      name: 'my-app',
      exec_mode: 'cluster',
      instances: 1,
      env: { port: '3000', time: 'zzz' }
    })
    should(env.port).eql('3000')
    should(env.time).eql('zzz')
  })
})
