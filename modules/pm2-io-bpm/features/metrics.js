'use strict'

const Debug = require('debug')
const EventLoopHandlesRequestsMetric = require('../metrics/eventLoopMetrics')

function getObjectAtPath (context, path) {
  if (path.indexOf('.') === -1 && path.indexOf('[') === -1) {
    return context[path]
  }
  let crumbs = path.split(/\.|\[|\]/g)
  let i = -1
  let len = crumbs.length
  let result
  while (++i < len) {
    if (i === 0) result = context
    if (!crumbs[i]) continue
    if (result === undefined) break
    result = result[crumbs[i]]
  }
  return result
}
const NetworkMetric = require('../metrics/network')
const HttpMetrics = require('../metrics/httpMetrics')
const V8Metric = require('../metrics/v8')
const RuntimeMetrics = require('../metrics/runtime')

const defaultMetricConf = {
  eventLoop: true,
  network: false,
  http: true,
  runtime: true,
  v8: true
}

const availableMetrics = [
  {
    name: 'eventloop',
    module: EventLoopHandlesRequestsMetric,
    optionsPath: 'eventLoop'
  },
  {
    name: 'http',
    module: HttpMetrics,
    optionsPath: 'http'
  },
  {
    name: 'network',
    module: NetworkMetric,
    optionsPath: 'network'
  },
  {
    name: 'v8',
    module: V8Metric,
    optionsPath: 'v8'
  },
  {
    name: 'runtime',
    module: RuntimeMetrics,
    optionsPath: 'runtime'
  }
]

class MetricsFeature {
  constructor () {
    this.logger = Debug('axm:features:metrics')
  }

  init (options) {
    if (typeof options !== 'object') options = {}
    this.logger('init')

    for (let availableMetric of availableMetrics) {
      const metric = new availableMetric.module()
      let config = undefined
      if (typeof availableMetric.optionsPath !== 'string') {
        config = {}
      } else if (availableMetric.optionsPath === '.') {
        config = options
      } else {
        config = getObjectAtPath(options, availableMetric.optionsPath)
      }
      metric.init(config)
      availableMetric.instance = metric
    }
  }

  get (name) {
    const metric = availableMetrics.find(metric => metric.name === name)
    if (metric === undefined) return undefined
    return metric.instance
  }

  destroy () {
    this.logger('destroy')
    for (let availableMetric of availableMetrics) {
      if (availableMetric.instance === undefined) continue
      availableMetric.instance.destroy()
    }
  }
}

module.exports = { MetricsFeature, defaultMetricConf }
