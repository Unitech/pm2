
const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}
describe.skip('HttpWrapper', function () {
  this.timeout(10000)
  it('should wrap http and send basic metric', (done) => {
    const child = launch('../fixtures/metrics/httpWrapperChild')
    let called = false

    child.on('message', (pck) => {

      if (pck.type === 'axm:monitor') {
        if (called === true) return
        called = true
        assert.strictEqual(pck.data.HTTP.type, 'internal/http/builtin/reqs')
        assert.strictEqual(pck.data.HTTP.unit, 'req/min')

        assert.strictEqual(pck.data['HTTP Mean Latency'].type, 'internal/http/builtin/latency/p50')
        assert.strictEqual(pck.data['HTTP Mean Latency'].unit, 'ms')

        child.kill('SIGINT')
        done()
      }
    })
  })

  it('should use tracing system', (done) => {
    const child = launch('../fixtures/metrics/tracingChild')
    let called = false
    child.on('message', (pck) => {
      if (pck.type === 'trace-span' && called === false) {
        called = true
        assert.strictEqual(pck.data.hasOwnProperty('id'), true)
        assert.strictEqual(pck.data.hasOwnProperty('traceId'), true)
        assert.strictEqual(pck.data.tags['http.method'], 'GET')
        assert.strictEqual(pck.data.tags['http.status_code'], '200')

        child.kill('SIGINT')
        done()
      }
    })
  })
})
