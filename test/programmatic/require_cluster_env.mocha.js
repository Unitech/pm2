
process.chdir(__dirname)

var fs = require('fs')
var path = require('path')
var PM2 = require('../..')
var should = require('should')

var CLUSTER_RESULT = path.join(__dirname, '..', 'require-env-cluster-result.json')
var FORK_RESULT    = path.join(__dirname, '..', 'require-env-fork-result.json')
var REQUIRE_SCRIPT = path.resolve(__dirname, '../fixtures/require-env-capture.js')

// In cluster mode PM2 serialises env vars into a pm2_env JSON string and the
// entry wrapper (ProcessContainer.js) unpacks it.  Node.js processes execArgv
// (including --require flags) *before* that wrapper runs, so without the fix a
// library loaded via --require would see the raw JSON blob rather than the
// individual env vars.  ProcessContainerClusterInitEnv.js is prepended as the
// first --require so the env is expanded before any user --require runs.

describe('--require script env var visibility', function () {
  this.timeout(15000)

  before(function (done) {
    try { fs.unlinkSync(CLUSTER_RESULT) } catch (e) {}
    try { fs.unlinkSync(FORK_RESULT) } catch (e) {}
    PM2.delete('all', function () { done() })
  })

  after(function (done) {
    try { fs.unlinkSync(CLUSTER_RESULT) } catch (e) {}
    try { fs.unlinkSync(FORK_RESULT) } catch (e) {}
    PM2.kill(done)
  })

  afterEach(function (done) {
    PM2.delete('all', done)
  })

  it('should expose PM2 env vars to --require scripts in cluster mode', function (done) {
    PM2.start({
      script: './../fixtures/empty.js',
      name: 'test-require-env-cluster',
      exec_mode: 'cluster',
      instances: 1,
      node_args: ['--require', REQUIRE_SCRIPT],
      env: {
        PM2_TEST_REQUIRE_VAR: 'cluster-env-value',
        PM2_REQUIRE_RESULT_FILE: CLUSTER_RESULT
      }
    }, function (err) {
      should(err).be.null()

      setTimeout(function () {
        var data = JSON.parse(fs.readFileSync(CLUSTER_RESULT, 'utf8'))
        data.value.should.eql(
          'cluster-env-value',
          'PM2_TEST_REQUIRE_VAR should be visible in --require script running in cluster mode'
        )
        done()
      }, 3000)
    })
  })

  it('should expose PM2 env vars to --require scripts in fork mode', function (done) {
    PM2.start({
      script: './../fixtures/empty.js',
      name: 'test-require-env-fork',
      exec_mode: 'fork',
      node_args: ['--require', REQUIRE_SCRIPT],
      env: {
        PM2_TEST_REQUIRE_VAR: 'fork-env-value',
        PM2_REQUIRE_RESULT_FILE: FORK_RESULT
      }
    }, function (err) {
      should(err).be.null()

      setTimeout(function () {
        var data = JSON.parse(fs.readFileSync(FORK_RESULT, 'utf8'))
        data.value.should.eql(
          'fork-env-value',
          'PM2_TEST_REQUIRE_VAR should be visible in --require script running in fork mode'
        )
        done()
      }, 3000)
    })
  })
})
