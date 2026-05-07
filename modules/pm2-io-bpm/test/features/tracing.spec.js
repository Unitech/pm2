const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: [],
    env: { NODE_ENV: 'test' }
  })
}

describe.skip('Tracing with IPC transport', function () {
  this.timeout(10000)

  it('should use tracing system', (done) => {
    const child = launch('../fixtures/metrics/tracingChild')
    const spans = []
    child.on('message', (pck) => {
      if (pck.type !== 'trace-span') return
      assert.strictEqual(pck.data.hasOwnProperty('id'), true)
      assert.strictEqual(pck.data.hasOwnProperty('traceId'), true)
      spans.push(pck.data)
      if (spans.length === 4) {
        assert(spans.filter(span => span.name === 'http-get').length === 1) // client
        assert(spans.filter(span => span.name === '/toto').length === 1) // server
        assert(spans.filter(span => span.name === 'customspan').length === 1) // custom span using api
        child.kill('SIGKILL')
        return done()
      }
    })
  })
})
