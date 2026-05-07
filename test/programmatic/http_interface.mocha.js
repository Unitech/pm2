
process.chdir(__dirname)

var http = require('http')
var fork = require('child_process').fork
var path = require('path')
var PM2 = require('../..')
var should = require('should')

var WEB_PORT = 19615

describe('HttpInterface', function () {
  this.timeout(30000)

  var webChild = null

  before(function (done) {
    PM2.delete('all', function () {
      PM2.start({
        script: './../fixtures/echo.js',
        name: 'test-http-interface',
        env: {
          SECRET_KEY: 'should_be_stripped',
          DATABASE_URL: 'postgres://secret@host/db'
        }
      }, done)
    })
  })

  after(function (done) {
    if (webChild) {
      webChild.kill()
      webChild = null
    }
    PM2.kill(done)
  })

  afterEach(function () {
    if (webChild) {
      webChild.kill()
      webChild = null
    }
  })

  function startWebInterface(envVars, cb) {
    var env = Object.assign({}, process.env, {
      PM2_API_PORT: WEB_PORT
    }, envVars)

    webChild = fork(
      path.resolve(__dirname, '../../lib/HttpInterface.js'),
      [],
      { env: env, silent: true }
    )

    var started = false
    webChild.stderr.on('data', function () {})
    webChild.stdout.on('data', function (data) {
      if (!started && data.toString().indexOf('Web interface listening') > -1) {
        started = true
        cb()
      }
    })

    setTimeout(function () {
      if (!started) {
        started = true
        cb()
      }
    }, 5000)
  }

  function httpGet(cb) {
    http.get('http://127.0.0.1:' + WEB_PORT + '/', function (res) {
      var body = ''
      res.on('data', function (chunk) { body += chunk })
      res.on('end', function () {
        cb(null, res, body)
      })
    }).on('error', cb)
  }

  describe('CORS wildcard', function () {
    it('should have Access-Control-Allow-Origin set to * (vulnerability)', function (done) {
      startWebInterface({}, function () {
        httpGet(function (err, res, body) {
          should(err).be.null()
          // BUG: CORS is set to wildcard, allowing any origin to read process data
          res.headers['access-control-allow-origin'].should.eql('*')
          done()
        })
      })
    })
  })

  describe('WEB_STRIP_ENV_VARS broken logic', function () {
    it('should expose env vars when WEB_STRIP_ENV_VARS is not set', function (done) {
      startWebInterface({}, function () {
        httpGet(function (err, res, body) {
          should(err).be.null()
          var data = JSON.parse(body)
          should(data.processes.length).be.above(0)
          var proc = data.processes[0]
          // env should be present when stripping is disabled
          should.exists(proc.pm2_env.env)
          done()
        })
      })
    })

    it('should strip env vars when WEB_STRIP_ENV_VARS is true', function (done) {
      startWebInterface({ PM2_WEB_STRIP_ENV_VARS: 'true' }, function () {
        httpGet(function (err, res, body) {
          should(err).be.null()
          var data = JSON.parse(body)
          should(data.processes.length).be.above(0)
          var proc = data.processes[0]

          // BUG: HttpInterface.js line 54 uses && instead of ||:
          //   if (typeof proc.pm2_env === 'undefined' && typeof proc.pm2_env.env === 'undefined') return;
          // This means the env is NEVER stripped. Fix: change && to ||.
          should(proc.pm2_env.env === undefined).be.true('env should have been stripped but was not')
          done()
        })
      })
    })
  })
})
