'use strict'

const v8 = require('v8')
const { ServiceManager } = require('../serviceManager')
const Debug = require('debug')
const Gauge = require('../utils/metrics/gauge')

const defaultOptions = {
  new_space: false,
  old_space: false,
  map_space: false,
  code_space: false,
  large_object_space: false,
  heap_total_size: true,
  heap_used_size: true,
  heap_used_percent: true
}

class V8Metric {
  constructor () {
    this.timer = undefined
    this.TIME_INTERVAL = 800
    this.metricService = undefined
    this.logger = Debug('axm:features:metrics:v8')
    this.metricStore = new Map()
    this.unitKB = 'MiB'
    this.metricsDefinitions = {
      total_heap_size: {
        name: 'Heap Size',
        id: 'internal/v8/heap/total',
        unit: this.unitKB,
        historic: true
      },
      heap_used_percent: {
        name: 'Heap Usage',
        id: 'internal/v8/heap/usage',
        unit: '%',
        historic: true
      },
      used_heap_size: {
        name: 'Used Heap Size',
        id: 'internal/v8/heap/used',
        unit: this.unitKB,
        historic: true
      }
    }
  }

  init (config) {
    if (config === false) return
    if (config === undefined) {
      config = defaultOptions
    }
    if (config === true) {
      config = defaultOptions
    }

    this.metricService = ServiceManager.get('metrics')
    if (this.metricService === undefined) return this.logger('Failed to load metric service')
    this.logger('init')

    if (!v8.hasOwnProperty('getHeapStatistics')) {
      return this.logger('V8.getHeapStatistics is not available, aborting')
    }

    for (let metricName in this.metricsDefinitions) {
      if (config[metricName] === false) continue
      const isEnabled = config[metricName]
      if (isEnabled === false) continue
      let metric = this.metricsDefinitions[metricName]
      this.metricStore.set(metricName, this.metricService.metric(metric))
    }

    this.timer = setInterval(() => {
      const stats = v8.getHeapStatistics()
      for (let metricName in this.metricsDefinitions) {
        if (typeof stats[metricName] !== 'number') continue
        const gauge = this.metricStore.get(metricName)
        if (gauge === undefined) continue
        gauge.set(this._formatMiBytes(stats[metricName]))
      }
      const usage = (stats.used_heap_size / stats.total_heap_size * 100).toFixed(2)
      const usageMetric = this.metricStore.get('heap_used_percent')
      if (usageMetric !== undefined) {
        usageMetric.set(parseFloat(usage))
      }
    }, this.TIME_INTERVAL)

    this.timer.unref()
  }

  destroy () {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
    }
    this.logger('destroy')
  }

  _formatMiBytes (val) {
    return (val / 1024 / 1024).toFixed(2)
  }
}

module.exports = V8Metric
