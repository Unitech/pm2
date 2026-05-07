'use strict'

const shimmer = require('../utils/shimmer')
const Debug = require('debug')
const Configuration = require('../configuration')
const { ServiceManager } = require('../serviceManager')
const Meter = require('../utils/metrics/meter')
const Histogram = require('../utils/metrics/histogram')

const {
  MetricType
} = require('../services/metrics')

class HttpMetrics {
  constructor () {
    this.defaultConf = {
      http: true
    }
    this.metrics = new Map()
    this.logger = Debug('axm:features:metrics:http')
    this.metricService = undefined
    this.modules = {}
  }

  init (config) {
    if (config === false) return
    if (config === undefined) {
      config = this.defaultConf
    }
    if (typeof config !== 'object') {
      config = this.defaultConf
    }
    this.logger('init')
    Configuration.configureModule({
      latency: true
    })
    this.metricService = ServiceManager.get('metrics')
    if (this.metricService === undefined) return this.logger('Failed to load metric service')

    this.logger('hooking to require')
    this._hookRequire()
  }

  _registerHttpMetric () {
    if (this.metricService === undefined) return this.logger('Failed to load metric service')
    const histogram = new Histogram()
    const p50 = {
      name: 'HTTP Mean Latency',
      id: 'internal/http/builtin/latency/p50',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      unit: 'ms',
      handler: () => {
        const percentiles = histogram.percentiles([ 0.5 ])
        return percentiles[0.5]
      }
    }
    const p95 = {
      name: 'HTTP P95 Latency',
      id: 'internal/http/builtin/latency/p95',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      handler: () => {
        const percentiles = histogram.percentiles([ 0.95 ])
        return percentiles[0.95]
      },
      unit: 'ms'
    }
    const meter = {
      name: 'HTTP',
      historic: true,
      id: 'internal/http/builtin/reqs',
      unit: 'req/min'
    }
    this.metricService.registerMetric(p50)
    this.metricService.registerMetric(p95)
    this.metrics.set('http.latency', histogram)
    this.metrics.set('http.meter', this.metricService.meter(meter))
  }

  _registerHttpsMetric () {
    if (this.metricService === undefined) return this.logger('Failed to load metric service')
    const histogram = new Histogram()
    const p50 = {
      name: 'HTTPS Mean Latency',
      id: 'internal/https/builtin/latency/p50',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      unit: 'ms',
      handler: () => {
        const percentiles = histogram.percentiles([ 0.5 ])
        return percentiles[0.5]
      }
    }
    const p95 = {
      name: 'HTTPS P95 Latency',
      id: 'internal/https/builtin/latency/p95',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      handler: () => {
        const percentiles = histogram.percentiles([ 0.95 ])
        return percentiles[0.95]
      },
      unit: 'ms'
    }
    const meter = {
      name: 'HTTPS',
      historic: true,
      id: 'internal/https/builtin/reqs',
      unit: 'req/min'
    }
    this.metricService.registerMetric(p50)
    this.metricService.registerMetric(p95)
    this.metrics.set('https.latency', histogram)
    this.metrics.set('https.meter', this.metricService.meter(meter))
  }

  destroy () {
    if (this.modules.http !== undefined) {
      this.logger('unwraping http module')
      shimmer.unwrap(this.modules.http, 'emit')
      this.modules.http = undefined
    }
    if (this.modules.https !== undefined) {
      this.logger('unwraping https module')
      shimmer.unwrap(this.modules.https, 'emit')
      this.modules.https = undefined
    }
    this.logger('destroy')
  }

  _hookHttp (nodule, name) {
    if (nodule.Server === undefined || nodule.Server.prototype === undefined) return
    if (this.modules[name] !== undefined) return this.logger(`Module ${name} already hooked`)
    this.logger(`Hooking to ${name} module`)
    this.modules[name] = nodule.Server.prototype
    if (name === 'http') {
      this._registerHttpMetric()
    } else if (name === 'https') {
      this._registerHttpsMetric()
    }
    const self = this
    shimmer.wrap(nodule.Server.prototype, 'emit', (original) => {
      return function (event, req, res) {
        if (event !== 'request') return original.apply(this, arguments)

        const meter = self.metrics.get(`${name}.meter`)
        if (meter !== undefined) {
          meter.mark()
        }
        const latency = self.metrics.get(`${name}.latency`)
        if (latency === undefined) return original.apply(this, arguments)
        if (res === undefined || res === null) return original.apply(this, arguments)
        const startTime = Date.now()
        res.once('finish', _ => {
          latency.update(Date.now() - startTime)
        })
        return original.apply(this, arguments)
      }
    })
  }

  _hookRequire () {
    const http = require('http')
    const https = require('https')
    this._hookHttp(http, 'http')
    this._hookHttp(https, 'https')
  }
}

module.exports = HttpMetrics
