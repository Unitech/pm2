//#4596 #6176

process.chdir(__dirname)

// set before the daemon is spawned so it inherits it too: in cluster mode
// the worker starts from the daemon env, so a leak shows up there
process.env.SHOULD_NOT_BE_THERE = 'true'

var PM2 = require('../..')
var should = require('should')
var fs = require('fs')
var os = require('os')
var path = require('path')

var DUMP = path.join(os.tmpdir(), 'pm2-filter-env-dump-' + process.pid + '.json')

/**
 * Run assertions and report them through done(): a throw inside a PM2
 * callback would otherwise wedge the RPC client and hang the next hook
 */
function check(done, fn) {
  try { fn() } catch (e) { return done(e) }
  done()
}

/**
 * Wait for dump-env.js to write the environment the app actually received
 */
function readDump(cb) {
  var tries = 0
  ;(function wait() {
    if (fs.existsSync(DUMP))
      return cb(null, JSON.parse(fs.readFileSync(DUMP, 'utf8')))
    if (++tries > 50)
      return cb(new Error('app never dumped its environment'))
    setTimeout(wait, 100)
  })()
}

describe('API checks', function() {
  before(function(done) {
    PM2.delete('all', function() { done() })
  })

  after(function(done) {
    try { fs.unlinkSync(DUMP) } catch (e) {}
    PM2.kill(done)
  })

  beforeEach(function() {
    process.env.SHOULD_NOT_BE_THERE = 'true'
    try { fs.unlinkSync(DUMP) } catch (e) {}
  })

  afterEach(function(done) {
    PM2.delete('all', function() { done() })
  })

  it('should start app and validate presence of env var', function(done) {
    PM2.start({
      script: './../fixtures/echo.js'
    }, (err) => {
      should(err).be.null()
      PM2.list(function(err, list) {
        should(err).be.null()
        should(list.length).eql(1)
        should.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
        done()
      })
    })
  })

  it('should start app with filtered env wth array of env to be ignored', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      filter_env: ['SHOULD_NOT_BE_THERE']
    }, (err) => {
      should(err).be.null()
      PM2.list(function(err, list) {
        should(err).be.null()
        should(list.length).eql(1)
        should.not.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
        done()
      })
    })
  })

  it('should start app with filtered env with string env name to be ignored', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      filter_env: 'SHOULD_NOT_BE_THERE'
    }, (err) => {
      if (err) return done(err)
      PM2.list(function(err, list) {
        check(done, function() {
          should(err).be.null()
          should(list.length).eql(1)
          should.not.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
          // filtering must not touch the caller's own environment
          should(process.env.SHOULD_NOT_BE_THERE).eql('true')
        })
      })
    })
  })

  it('should start app with filtered env at true to drop all local env', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      filter_env: true
    }, (err) => {
      if (err) return done(err)
      PM2.list(function(err, list) {
        check(done, function() {
          should(err).be.null()
          should(list.length).eql(1)
          should.not.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
        })
      })
    })
  })

  ;['fork', 'cluster'].forEach(function(mode) {
    it('should only pass declared env to a ' + mode + ' app with filter_env at true', function(done) {
      PM2.start({
        script: './../fixtures/dump-env.js',
        exec_mode: mode,
        filter_env: true,
        env: { ENV_DUMP_FILE: DUMP, ONLY_THIS: '1' }
      }, (err) => {
        if (err) return done(err)
        readDump(function(err, env) {
          check(done, function() {
            should(err).be.null()
            should(env.ONLY_THIS).eql('1')
            should.not.exists(env.SHOULD_NOT_BE_THERE)
          })
        })
      })
    })
  })

  ;['restart', 'reload'].forEach(function(action) {
    // filterEnv: [] is what commander passes when --filter-env is not given
    it('should not merge the shell env on ' + action + ' --update-env with filter_env at true', function(done) {
      PM2.start({
        script: './../fixtures/echo.js',
        name: 'filtered',
        exec_mode: 'cluster',
        instances: 1,
        filter_env: true
      }, (err) => {
        if (err) return done(err)
        process.env.LEAK_6176 = 'secret'
        PM2[action]('filtered', { updateEnv: true, filterEnv: [] }, function(err) {
          delete process.env.LEAK_6176
          if (err) return done(err)
          PM2.list(function(err, list) {
            check(done, function() {
              should(err).be.null()
              var pm2_env = list[0].pm2_env
              should(pm2_env.filter_env).eql(true)
              should.not.exists(pm2_env.LEAK_6176)
              should.not.exists(pm2_env.env.LEAK_6176)
              should.not.exists(pm2_env.SHOULD_NOT_BE_THERE)
            })
          })
        })
      })
    })

    it('should not merge the shell env on ' + action + ' ecosystem --update-env with filter_env at true', function(done) {
      var conf = './../fixtures/filter-env-ecosystem.json'
      PM2.start(conf, (err) => {
        if (err) return done(err)
        process.env.LEAK_6176 = 'secret'
        PM2[action](conf, { updateEnv: true }, function(err) {
          delete process.env.LEAK_6176
          if (err) return done(err)
          PM2.list(function(err, list) {
            check(done, function() {
              should(err).be.null()
              var pm2_env = list[0].pm2_env
              should(pm2_env.filter_env).eql(true)
              should.not.exists(pm2_env.LEAK_6176)
              should.not.exists(pm2_env.env.LEAK_6176)
              should.not.exists(pm2_env.SHOULD_NOT_BE_THERE)
            })
          })
        })
      })
    })
  })

  it('should still merge the shell env on restart --update-env without filter_env', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'unfiltered'
    }, (err) => {
      if (err) return done(err)
      process.env.LEAK_6176 = 'wanted'
      PM2.restart('unfiltered', { updateEnv: true, filterEnv: [] }, function(err) {
        delete process.env.LEAK_6176
        if (err) return done(err)
        PM2.list(function(err, list) {
          check(done, function() {
            should(err).be.null()
            should(list[0].pm2_env.LEAK_6176).eql('wanted')
          })
        })
      })
    })
  })
})
