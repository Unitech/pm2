
process.chdir(__dirname)

var fs = require('fs')
var path = require('path')
var PM2 = require('../..')
var should = require('should')

var RESULT_FILE = path.join(__dirname, '..', 'env-report-result.json')

describe('Issue #6073 - [object Object] env vars leaked to subprocesses', function () {
  this.timeout(30000)

  after(function (done) {
    try { fs.unlinkSync(RESULT_FILE) } catch (e) {}
    PM2.kill(done)
  })

  before(function (done) {
    try { fs.unlinkSync(RESULT_FILE) } catch (e) {}
    PM2.delete('all', function () { done() })
  })

  it('should not leak [object Object] env vars to fork mode child process.env', function (done) {
    PM2.start({
      script: './../fixtures/env-report.js',
      name: 'test-env-leak',
      exec_mode: 'fork',
      force: true
    }, function (err) {
      should(err).be.null()

      setTimeout(function () {
        var data = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'))

        data.object_keys.length.should.eql(0,
          'Child process.env contains [object Object] for keys: ' + data.object_keys.join(', '))
        done()
      }, 2000)
    })
  })
})
