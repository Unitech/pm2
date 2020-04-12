//#4596

process.chdir(__dirname)

process.env.SHOULD_NOT_BE_THERE = 'true'

var PM2 = require('../..')
var should = require('should')

describe('API checks', function() {
  before(function(done) {
    PM2.delete('all', function() { done() })
  })

  after(function(done) {
    PM2.kill(done)
  })

  afterEach(function(done) {
    PM2.delete('all', done)
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
      should(err).be.null()
      PM2.list(function(err, list) {
        should(err).be.null()
        should(list.length).eql(1)
        should.not.exists(list[0].pm2_env.SHOULD_NOT_BE_THERE)
        done()
      })
    })
  })

  it('should start app with filtered env at true to drop all local env', function(done) {
    PM2.start({
      script: './../fixtures/echo.js',
      filter_env: true
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
})
