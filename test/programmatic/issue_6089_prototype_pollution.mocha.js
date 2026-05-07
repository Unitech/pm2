
process.chdir(__dirname)

var should = require('should')
var PM2 = require('../..')
var Configuration = require('../../lib/Configuration.js')

describe('Issue #6089 - Configuration prototype pollution', function () {
  this.timeout(30000)

  before(function (done) {
    PM2.list(done)
  })

  afterEach(function () {
    delete Object.prototype.polluted
    delete Object.prototype.rce
  })

  describe('set (async)', function () {
    it('should reject __proto__ key', function (done) {
      Configuration.set('__proto__.polluted', 'yes', function (err) {
        should(({}).polluted).be.undefined()
        done()
      })
    })

    it('should reject constructor.prototype key', function (done) {
      Configuration.set('constructor.prototype.polluted', 'yes', function (err) {
        should(({}).polluted).be.undefined()
        done()
      })
    })
  })

  describe('setSync', function () {
    it('should reject __proto__ key', function () {
      Configuration.setSync('__proto__.polluted', 'yes')
      should(({}).polluted).be.undefined()
    })

    it('should reject prototype key', function () {
      Configuration.setSync('constructor.prototype.polluted', 'yes')
      should(({}).polluted).be.undefined()
    })
  })

  describe('unset (async)', function () {
    it('should reject __proto__ traversal', function (done) {
      Object.prototype.rce = 'exists'
      Configuration.unset('__proto__.rce', function (err) {
        should(({}).rce).eql('exists')
        delete Object.prototype.rce
        done()
      })
    })
  })

  describe('unsetSync', function () {
    it('should reject __proto__ traversal', function () {
      Object.prototype.rce = 'exists'
      Configuration.unsetSync('__proto__.rce')
      should(({}).rce).eql('exists')
      delete Object.prototype.rce
    })
  })
})
