
const { InternalMetric, MetricService, MetricMeasurements } = require('../../services/metrics')
const { IPCTransport } = require('../../transports/IPCTransport')
const { ServiceManager } = require('../../serviceManager')
const assert = require('assert')

describe('MetricsService', function () {
  this.timeout(5000)

  const transport = new IPCTransport()
  transport.init()
  ServiceManager.set('transport', transport)
  const service = new MetricService()
  service.init()

  describe('basic', () => {
    it('register gauge', (done) => {
      transport.setMetrics = function (metrics) {
        const gauge = metrics.find(metric => metric.name === 'gauge')
        assert(gauge !== undefined)
        return done()
      }
      const gauge = service.metric({
        name: 'gauge'
      })
      gauge.set(10)
    })
    it('register gauge (with custom handler)', (done) => {
      transport.setMetrics = function (metrics) {
        const gauge = metrics.find(metric => metric.name === 'gauge')
        assert(gauge !== undefined)
        return done()
      }
      const gauge = service.metric({
        name: 'gauge',
        value: () => 10
      })
    })
    it('register meter', (done) => {
      transport.setMetrics = function (metrics) {
        const meter = metrics.find(metric => metric.name === 'meter')
        assert(meter !== undefined)
        return done()
      }
      const meter = service.meter({
        name: 'meter'
      })
      meter.mark()
    })
    it('register histogram', (done) => {
      transport.setMetrics = function (metrics) {
        const histogram = metrics.find(metric => metric.name === 'histogram')
        assert(histogram !== undefined)
        return done()
      }
      const histogram = service.histogram({
        name: 'histogram',
        measurement: MetricMeasurements.min
      })
      histogram.update(10000)
    })
    it('register counter', (done) => {
      transport.setMetrics = function (metrics) {
        const counter = metrics.find(metric => metric.name === 'counter')
        assert(counter !== undefined)
        return done()
      }
      const counter = service.counter({
        name: 'counter'
      })
      counter.inc()
    })
    it('should send value for all metrics', (done) => {
      let called = false
      transport.setMetrics = function (metrics) {
        if (called === true) return
        called = true

        const counter = metrics.find(metric => metric.name === 'counter')
        const histogram = metrics.find(metric => metric.name === 'histogram')
        const meter = metrics.find(metric => metric.name === 'meter')
        const gauge = metrics.find(metric => metric.name === 'gauge')
        assert(counter !== undefined && counter.value === 1)
        assert(meter !== undefined)
        assert(histogram !== undefined && histogram.value > 0)
        assert(gauge !== undefined && gauge.value === 10)
        return done()
      }
    })
  })
})
