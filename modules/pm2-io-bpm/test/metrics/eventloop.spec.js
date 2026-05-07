const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

//process.env.DEBUG = 'axm:services:runtimeStats,axm:features:metrics:eventloop'

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

const includes = (array, value) => {
  return array.some(tmp => tmp === value)
}

describe('EventLoopHandlesRequests', function () {
  this.timeout(10000)

  it('should send event loop with runtime stats', (done) => {
    const child = launch('../fixtures/metrics/gcv8Child')

    child.on('message', (pck) => {
      if (pck.type === 'axm:monitor') {
        const metricsName = Object.keys(pck.data)
        const metricsThatShouldBeThere = [
          'Event Loop Latency',
          'Event Loop Latency p95',
          'Active handles',
          'Active requests'
        ]
        if (metricsName.filter(name => includes(metricsThatShouldBeThere, name)).length === metricsThatShouldBeThere.length) {
          child.kill('SIGINT')
          done()
        }
      }
    })
  })
  it('should send event without runtime stats', (done) => {
    process.env.PM2_APM_DISABLE_RUNTIME_STATS = 'true'
    const child = launch('../fixtures/metrics/gcv8Child')

    child.on('message', (pck) => {
      if (pck.type === 'axm:monitor') {
        const metricsName = Object.keys(pck.data)
        const metricsThatShouldBeThere = [
          'Event Loop Latency',
          'Active handles',
          'Active requests',
          'Event Loop Latency p95'
        ]
        if (metricsName.filter(name => includes(metricsThatShouldBeThere, name)).length === metricsThatShouldBeThere.length) {
          child.kill('SIGINT')
          done()
        }
      }
    })
  })
})
