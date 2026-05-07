'use strict'

const AddonProfiler = require('../profilers/addonProfiler')
const InspectorProfiler = require('../profilers/inspectorProfiler')
const { canUseInspector } = require('../constants')
const Debug = require('debug')

const defaultProfilingConfig = {
  cpuJS: true,
  heapSnapshot: true,
  heapSampling: true,
  implementation: 'both'
}

const disabledProfilingConfig = {
  cpuJS: false,
  heapSnapshot: false,
  heapSampling: false,
  implementation: 'none'
}

class ProfilingFeature {
  constructor () {
    this.profiler = undefined
    this.logger = Debug('axm:features:profiling')
  }

  init (config) {
    if (config === true) {
      config = defaultProfilingConfig
    } else if (config === false) {
      config = disabledProfilingConfig
    } else if (config === undefined) {
      config = defaultProfilingConfig
    }

    if (process.env.PM2_PROFILING_FORCE_FALLBACK === 'true') {
      config.implementation = 'addon'
    }
    if (config.implementation === undefined || config.implementation === 'both') {
      config.implementation = canUseInspector() === true ? 'inspector' : 'addon'
    }

    switch (config.implementation) {
      case 'inspector': {
        this.logger('using inspector implementation')
        this.profiler = new InspectorProfiler()
        break
      }
      case 'addon': {
        this.logger('using addon implementation')
        this.profiler = new AddonProfiler()
        break
      }
      default: {
        return this.logger(`Invalid profiler implementation choosen: ${config.implementation}`)
      }
    }
    this.logger('init')
    this.profiler.init()
  }

  destroy () {
    this.logger('destroy')
    if (this.profiler === undefined) return
    this.profiler.destroy()
  }
}

module.exports = { ProfilingFeature }
