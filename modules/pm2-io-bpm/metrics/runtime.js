'use strict'

const { MetricType, MetricMeasurements } = require('../services/metrics')
const { ServiceManager } = require('../serviceManager')
const Debug = require('debug')
const Histogram = require('../utils/metrics/histogram')

const defaultOptions = {
  gcNewPause: true,
  gcOldPause: true,
  pageFaults: true,
  contextSwitchs: true
}

class RuntimeMetrics {
  constructor () {
    this.metricService = undefined
    this.logger = Debug('axm:features:metrics:runtime')
    this.runtimeStatsService = undefined
    this.handle = undefined
    this.metrics = new Map()
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

    this.runtimeStatsService = ServiceManager.get('runtimeStats')
    if (this.runtimeStatsService === undefined) return this.logger('Failed to load runtime stats service')

    this.logger('init')

    const newHistogram = new Histogram()
    if (config.gcNewPause === true) {
      this.metricService.registerMetric({
        name: 'GC New Space Pause',
        id: 'internal/v8/gc/new/pause/p50',
        type: MetricType.histogram,
        historic: true,
        implementation: newHistogram,
        unit: 'ms',
        handler: function () {
          const percentiles = this.implementation.percentiles([ 0.5 ])
          return percentiles[0.5]
        }
      })
      this.metricService.registerMetric({
        name: 'GC New Space Pause p95',
        id: 'internal/v8/gc/new/pause/p95',
        type: MetricType.histogram,
        historic: true,
        implementation: newHistogram,
        unit: 'ms',
        handler: function () {
          const percentiles = this.implementation.percentiles([ 0.95 ])
          return percentiles[0.95]
        }
      })
    }

    const oldHistogram = new Histogram()
    if (config.gcOldPause === true) {
      this.metricService.registerMetric({
        name: 'GC Old Space Pause',
        id: 'internal/v8/gc/old/pause/p50',
        type: MetricType.histogram,
        historic: true,
        implementation: oldHistogram,
        unit: 'ms',
        handler: function () {
          const percentiles = this.implementation.percentiles([ 0.5 ])
          return percentiles[0.5]
        }
      })
      this.metricService.registerMetric({
        name: 'GC Old Space Pause p95',
        id: 'internal/v8/gc/old/pause/p95',
        type: MetricType.histogram,
        historic: true,
        implementation: oldHistogram,
        unit: 'ms',
        handler: function () {
          const percentiles = this.implementation.percentiles([ 0.95 ])
          return percentiles[0.95]
        }
      })
    }

    if (config.contextSwitchs === true) {
      const volontarySwitchs = this.metricService.histogram({
        name: 'Volontary CPU Context Switch',
        id: 'internal/uv/cpu/contextswitch/volontary',
        measurement: MetricMeasurements.mean
      })
      const inVolontarySwitchs = this.metricService.histogram({
        name: 'Involuntary CPU Context Switch',
        id: 'internal/uv/cpu/contextswitch/involontary',
        measurement: MetricMeasurements.mean
      })
      this.metrics.set('inVolontarySwitchs', inVolontarySwitchs)
      this.metrics.set('volontarySwitchs', volontarySwitchs)
    }

    if (config.pageFaults === true) {
      const softPageFault = this.metricService.histogram({
        name: 'Minor Page Fault',
        id: 'internal/uv/memory/pagefault/minor',
        measurement: MetricMeasurements.mean
      })
      const hardPageFault = this.metricService.histogram({
        name: 'Major Page Fault',
        id: 'internal/uv/memory/pagefault/major',
        measurement: MetricMeasurements.mean
      })
      this.metrics.set('softPageFault', softPageFault)
      this.metrics.set('hardPageFault', hardPageFault)
    }

    this.handle = (stats) => {
      if (typeof stats !== 'object' || typeof stats.gc !== 'object') return
      newHistogram.update(stats.gc.newPause)
      oldHistogram.update(stats.gc.oldPause)
      if (typeof stats.usage !== 'object') return
      const volontarySwitchs = this.metrics.get('volontarySwitchs')
      if (volontarySwitchs !== undefined) {
        volontarySwitchs.update(stats.usage.ru_nvcsw)
      }
      const inVolontarySwitchs = this.metrics.get('inVolontarySwitchs')
      if (inVolontarySwitchs !== undefined) {
        inVolontarySwitchs.update(stats.usage.ru_nivcsw)
      }
      const softPageFault = this.metrics.get('softPageFault')
      if (softPageFault !== undefined) {
        softPageFault.update(stats.usage.ru_minflt)
      }
      const hardPageFault = this.metrics.get('hardPageFault')
      if (hardPageFault !== undefined) {
        hardPageFault.update(stats.usage.ru_majflt)
      }
    }

    this.runtimeStatsService.on('data', this.handle)
  }

  destroy () {
    if (this.runtimeStatsService !== undefined) {
      this.runtimeStatsService.removeListener('data', this.handle)
    }
    this.logger('destroy')
  }
}

module.exports = RuntimeMetrics
