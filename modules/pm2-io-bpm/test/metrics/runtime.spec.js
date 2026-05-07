const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

//process.env.DEBUG = 'axm:services:runtimeStats,axm:features:metrics:runtime'

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe.skip('RuntimeStatsMetrics', function () {
  this.timeout(5000)

  it('should get GC stats', (done) => {
    const child = launch('../fixtures/metrics/gcv8Child')

    child.on('message', (pck) => {
      if (pck.type === 'axm:monitor') {
        const metricsName = Object.keys(pck.data)
        const hasGCMetrics = metricsName.some(name => !!name.match(/GC/))
        const hasPFMetrics = metricsName.some(name => !!name.match(/Page Fault/))
        const hasContextSwitchMetrics = metricsName.some(name => !!name.match(/Context Switch/))
        if (hasGCMetrics && hasContextSwitchMetrics && hasPFMetrics) {
          console.log(`found GC metrics: ${metricsName.filter(name => !!name.match(/GC/)).join(',')}`)
          child.kill('SIGINT')
          done()
        }
      }
    })
  })

  it('should not crash if runtime stats is disabled', (done) => {
    process.env.PM2_APM_DISABLE_RUNTIME_STATS = 'true'
    const child = launch('../fixtures/metrics/gcv8Child')

    setTimeout(_ => {
      child.on('message', (pck) => {
        if (pck.type === 'axm:monitor') {
          const metricsName = Object.keys(pck.data)
          assert(metricsName.every(name => !name.match(/GC/)), 'should have no GC metrics')
          assert(metricsName.every(name => !name.match(/Page Fault/)), 'should have no Page fault metrics')
          assert(metricsName.every(name => !name.match(/Context Switch/)), 'should have no context switch metrics')
          child.kill('SIGINT')
        }
      })
    }, 1000)
    child.on('exit', (code, signal) => {
      assert(code === null, 'should not have exit code')
      assert(signal === 'SIGINT', 'should have exit via sigint')
      done()
    })
  })
})
