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
var spawnSync = require('child_process').spawnSync

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
    // set by a previous PM2.start(conf) of this process: skips the CLI option
    // handling a real one-command CLI goes through
    delete process.env.PM2_JSON_PROCESSING
    try { fs.unlinkSync(DUMP) } catch (e) {}
  })

  afterEach(function(done) {
    delete process.env.LEAK_6176
    PM2.delete('all', function() { done() })
  })

  // the dump is a plain object: Windows names it Path
  function envPath(env) {
    return env[Object.keys(env).filter(function(k) { return k.toUpperCase() === 'PATH' })[0]]
  }

  function assertNoLeak(env, leaked) {
    should(envPath(env)).eql(process.env.PATH)
    should.not.exists(env[leaked])
    if (env.__PROC_ENVIRON__)
      env.__PROC_ENVIRON__.should.not.containEql(leaked)
  }

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

  // control: without it the cluster tests below prove nothing (a daemon
  // started elsewhere would not hold SHOULD_NOT_BE_THERE)
  it('should pass the daemon env to an unfiltered cluster app', function(done) {
    delete process.env.SHOULD_NOT_BE_THERE
    PM2.start({
      script: './../fixtures/dump-env.js',
      exec_mode: 'cluster',
      env: { ENV_DUMP_FILE: DUMP }
    }, (err) => {
      if (err) return done(err)
      readDump(function(err, env) {
        check(done, function() {
          should(err).be.null()
          should(env.SHOULD_NOT_BE_THERE).eql('true')
        })
      })
    })
  })

  ;['fork', 'cluster'].forEach(function(mode) {
    // SHOULD_NOT_BE_THERE is in the shell env and in the daemon env, that a
    // cluster worker starts from
    it('should only pass declared env and the OS base to a ' + mode + ' app with filter_env at true', function(done) {
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
            assertNoLeak(env, 'SHOULD_NOT_BE_THERE')
          })
        })
      })
    })

    it('should drop matching shell and daemon vars from a ' + mode + ' app with a filter_env array', function(done) {
      PM2.start({
        script: './../fixtures/dump-env.js',
        exec_mode: mode,
        filter_env: ['SHOULD_NOT'],
        env: { ENV_DUMP_FILE: DUMP }
      }, (err) => {
        if (err) return done(err)
        readDump(function(err, env) {
          check(done, function() {
            should(err).be.null()
            assertNoLeak(env, 'SHOULD_NOT_BE_THERE')
          })
        })
      })
    })

    it('should not pass the shell env to a ' + mode + ' app on restart --update-env with filter_env at true', function(done) {
      PM2.start({
        script: './../fixtures/dump-env.js',
        name: 'filtered',
        exec_mode: mode,
        filter_env: true,
        env: { ENV_DUMP_FILE: DUMP }
      }, (err) => {
        if (err) return done(err)
        readDump(function(err) {
          if (err) return done(err)
          fs.unlinkSync(DUMP)
          process.env.LEAK_6176 = 'secret'
          PM2.restart('filtered', { updateEnv: true }, function(err) {
            if (err) return done(err)
            readDump(function(err, env) {
              check(done, function() {
                should(err).be.null()
                assertNoLeak(env, 'LEAK_6176')
              })
            })
          })
        })
      })
    })
  })

  ;['restart', 'reload'].forEach(function(action) {
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
        PM2[action]('filtered', { updateEnv: true }, function(err) {
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

  // the worker is already running when ProcessContainer applies pm2_env
  it('should start a filtered cluster app with the startup variables of its env', function(done) {
    // JSC (Bun) has no --max-old-space-size
    if (process.versions.bun) return this.skip()
    PM2.start({
      script: './../fixtures/dump-env.js',
      exec_mode: 'cluster',
      filter_env: true,
      env: { ENV_DUMP_FILE: DUMP, NODE_OPTIONS: '--max-old-space-size=123' }
    }, (err) => {
      if (err) return done(err)
      readDump(function(err, env) {
        check(done, function() {
          should(err).be.null()
          env.__HEAP_LIMIT_MB__.should.be.below(400)
        })
      })
    })
  })

  // [] is what the 7.1.1 CLI stored for every app (resurrected from dump.pm2)
  it('should start a cluster app with filter_env [] or false as an unfiltered one', function(done) {
    if (process.versions.bun) return this.skip()
    function startDump(filter_env, cb) {
      var conf = {
        script: './../fixtures/dump-env.js',
        exec_mode: 'cluster',
        env: { ENV_DUMP_FILE: DUMP, NODE_OPTIONS: '--max-old-space-size=123' }
      }
      if (filter_env !== undefined) conf.filter_env = filter_env
      PM2.start(conf, (err) => {
        if (err) return cb(err)
        readDump(function(err, env) {
          try { fs.unlinkSync(DUMP) } catch (e) {}
          PM2.delete('all', function() { cb(err, env) })
        })
      })
    }

    startDump(undefined, function(err, base) {
      if (err) return done(err)
      startDump([], function(err, empty) {
        if (err) return done(err)
        startDump(false, function(err, off) {
          check(done, function() {
            should(err).be.null()
            ;[empty, off].forEach(function(env) {
              env.__HEAP_LIMIT_MB__.should.eql(base.__HEAP_LIMIT_MB__)
              should(env.SHOULD_NOT_BE_THERE).eql('true')
            })
          })
        })
      })
    })
  })

  // The ecosystem fixtures declare no env: a non-empty one replaces pm2_env.env
  // on restart and the shell merge would not be exercised

  it('should honor filter_env "true" (string) on an ecosystem restart', function(done) {
    var conf = './../fixtures/filter-env-string-true-ecosystem.json'
    PM2.start(conf, (err) => {
      if (err) return done(err)
      process.env.LEAK_6176 = 'secret'
      PM2.restart(conf, { updateEnv: true }, function(err) {
        if (err) return done(err)
        PM2.list(function(err, list) {
          check(done, function() {
            should(err).be.null()
            var pm2_env = list[0].pm2_env
            should.not.exists(pm2_env.LEAK_6176)
            should.not.exists(pm2_env.env.LEAK_6176)
            should.not.exists(pm2_env.SHOULD_NOT_BE_THERE)
          })
        })
      })
    })
  })

  it('should turn the filter off with filter_env false in the ecosystem file', function(done) {
    PM2.start('./../fixtures/filter-env-ecosystem.json', (err) => {
      if (err) return done(err)
      process.env.LEAK_6176 = 'wanted'
      PM2.restart('./../fixtures/filter-env-off-ecosystem.json', { updateEnv: true }, function(err) {
        if (err) return done(err)
        PM2.list(function(err, list) {
          check(done, function() {
            should(err).be.null()
            should(list[0].pm2_env.filter_env).eql([])
            should(list[0].pm2_env.LEAK_6176).eql('wanted')
          })
        })
      })
    })
  })

  // the file sets no filter_env: the one the app was started with still applies
  it('should keep the stored filter_env on an ecosystem restart that sets none', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      name: 'filtered',
      exec_mode: 'cluster',
      instances: 1,
      filter_env: true
    }, (err) => {
      if (err) return done(err)
      process.env.LEAK_6176 = 'secret'
      PM2.restart('./../fixtures/filter-env-unset-ecosystem.json', { updateEnv: true }, function(err) {
        if (err) return done(err)
        PM2.list(function(err, list) {
          check(done, function() {
            should(err).be.null()
            var pm2_env = list[0].pm2_env
            should(pm2_env.filter_env).eql(true)
            should.not.exists(pm2_env.LEAK_6176)
            should.not.exists(pm2_env.env.LEAK_6176)
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
      PM2.restart('unfiltered', { updateEnv: true }, function(err) {
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

  // through the real CLI: commander used to send filter_env: [] on every
  // command, so the bare flag did nothing and a plain restart reset the filter
  it('should drop the shell env with a bare --filter-env and keep it on a plain restart', function(done) {
    var res = pm2Cli(['start', './../fixtures/echo.js', '--name', 'cli-filtered', '--filter-env'])
    if (res.status !== 0) return done(new Error(String(res.stderr)))
    res = pm2Cli(['restart', 'cli-filtered'])
    if (res.status !== 0) return done(new Error(String(res.stderr)))

    PM2.list(function(err, list) {
      check(done, function() {
        should(err).be.null()
        var pm2_env = list[0].pm2_env
        should(pm2_env.filter_env).eql(true)
        should.not.exists(pm2_env.SHOULD_NOT_BE_THERE)
        should(pm2_env.PATH).eql(process.env.PATH)
      })
    })
  })

  it('should not filter with --filter-env=false', function(done) {
    var res = pm2Cli(['start', './../fixtures/echo.js', '--name', 'cli-off', '--filter-env=false'])
    if (res.status !== 0) return done(new Error(String(res.stderr)))

    PM2.list(function(err, list) {
      check(done, function() {
        should(err).be.null()
        should(list[0].pm2_env.filter_env).eql([])
        should(list[0].pm2_env.SHOULD_NOT_BE_THERE).eql('true')
      })
    })
  })

  it('should apply --filter-env to the apps of an ecosystem file', function(done) {
    var res = pm2Cli(['start', './../fixtures/filter-env-unset-ecosystem.json', '--filter-env'])
    if (res.status !== 0) return done(new Error(String(res.stderr)))

    PM2.list(function(err, list) {
      check(done, function() {
        should(err).be.null()
        should(list[0].pm2_env.filter_env).eql(true)
        should.not.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
      })
    })
  })

  // a timeout: spawnSync blocks the event loop, mocha's own could not fire
  function pm2Cli(args) {
    var bin = path.resolve(__dirname, '../../bin/pm2')
    return spawnSync(process.execPath, [bin].concat(args), { env: process.env, timeout: 15000 })
  }
})
