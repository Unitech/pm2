const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')
const OtelManager = require('../../../../lib/OtelManager')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: [],
    env: { NODE_ENV: 'test' }
  })
}

describe('OpenTelemetry tracing integration', function () {
  this.timeout(60000)

  before(function () {
    if (!OtelManager.isInstalled()) {
      OtelManager.install()
    }
  })

  it('should receive trace-span messages via IPC', (done) => {
    const child = launch('../fixtures/otelTracingChild')
    let received = false

    child.on('message', (pck) => {
      if (pck.type !== 'trace-span') return
      if (received) return
      received = true

      assert.strictEqual(typeof pck.data.id, 'string', 'span should have an id')
      assert.strictEqual(typeof pck.data.traceId, 'string', 'span should have a traceId')
      assert.strictEqual(typeof pck.data.name, 'string', 'span should have a name')
      assert.strictEqual(typeof pck.data.timestamp, 'number', 'span should have a timestamp')
      assert.strictEqual(typeof pck.data.duration, 'number', 'span should have a duration')
      assert.ok(pck.data.tags, 'span should have tags')

      child.kill('SIGINT')
      setTimeout(() => {
        child.kill('SIGKILL')
      }, 1000)
      done()
    })

    // failsafe if no spans received
    setTimeout(() => {
      if (!received) {
        child.kill('SIGKILL')
        done(new Error('No trace-span received within timeout'))
      }
    }, 12000)
  })

  it('should contain HTTP method and status in span tags', (done) => {
    const child = launch('../fixtures/otelTracingChild')
    let received = false

    child.on('message', (pck) => {
      if (pck.type !== 'trace-span') return
      if (!pck.data.tags || !pck.data.tags['http.method']) return
      if (received) return
      received = true

      assert.strictEqual(pck.data.tags['http.method'], 'GET')
      assert.strictEqual(pck.data.tags['http.status_code'], '200')

      child.kill('SIGINT')
      setTimeout(() => {
        child.kill('SIGKILL')
      }, 1000)
      done()
    })

    setTimeout(() => {
      if (!received) {
        child.kill('SIGKILL')
        done(new Error('No HTTP trace-span received within timeout'))
      }
    }, 12000)
  })

  it('should have server spans with correct kind', (done) => {
    const child = launch('../fixtures/otelTracingChild')
    let received = false

    child.on('message', (pck) => {
      if (pck.type !== 'trace-span') return
      if (received) return
      if (pck.data.kind !== 'SERVER') return
      received = true

      assert.strictEqual(pck.data.kind, 'SERVER')
      assert.ok(pck.data.name, 'server span should have a name')

      child.kill('SIGINT')
      setTimeout(() => {
        child.kill('SIGKILL')
      }, 1000)
      done()
    })

    setTimeout(() => {
      if (!received) {
        child.kill('SIGKILL')
        done(new Error('No SERVER span received'))
      }
    }, 12000)
  })

  it('should report otel_tracing option via axm:option:configuration', (done) => {
    const child = launch('../fixtures/otelTracingChild')
    let received = false

    child.on('message', (pck) => {
      if (pck.type !== 'axm:option:configuration') return
      if (!pck.data || pck.data.otel_tracing !== true) return
      if (received) return
      received = true

      assert.strictEqual(pck.data.otel_tracing, true)
      child.kill('SIGINT')
      setTimeout(() => {
        child.kill('SIGKILL')
      }, 1000)
      done()
    })

    setTimeout(() => {
      if (!received) {
        child.kill('SIGKILL')
        done(new Error('No axm:option:configuration with otel_tracing received within timeout'))
      }
    }, 12000)
  })
})
