'use strict'

const { NotifyFeature } = require('./features/notify')
const { ProfilingFeature } = require('./features/profiling')
const { EventsFeature } = require('./features/events')
const { MetricsFeature } = require('./features/metrics')
const { TracingFeature } = require('./features/tracing')
const { DependenciesFeature } = require('./features/dependencies')
const Debug = require('debug')

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

const availablesFeatures = [
  {
    name: 'notify',
    optionsPath: '.',
    module: NotifyFeature
  },
  {
    name: 'profiler',
    optionsPath: 'profiling',
    module: ProfilingFeature
  },
  {
    name: 'events',
    module: EventsFeature
  },
  {
    name: 'metrics',
    optionsPath: 'metrics',
    module: MetricsFeature
  },
  {
    name: 'tracing',
    optionsPath: '.',
    module: TracingFeature
  },
  {
    name: 'dependencies',
    module: DependenciesFeature
  }
]

class FeatureManager {

  constructor () {
    this.logger = Debug('axm:features')
  }

  /**
   * Construct all the features and init them with their respective configuration
   */
  init (options) {
    for (let availableFeature of availablesFeatures) {
      this.logger(`Creating feature ${availableFeature.name}`)
      const feature = new availableFeature.module()
      let config = undefined
      if (typeof availableFeature.optionsPath !== 'string') {
        config = {}
      } else if (availableFeature.optionsPath === '.') {
        config = options
      } else {
        config = getObjectAtPath(options, availableFeature.optionsPath)
      }
      this.logger(`Init feature ${availableFeature.name}`)
      feature.init(config)
      availableFeature.instance = feature
    }
  }

  /**
   * Get a internal implementation of a feature method
   * WARNING: should only be used by user facing API
   */
  get (name) {
    const feature = availablesFeatures.find(feature => feature.name === name)
    if (feature === undefined || feature.instance === undefined) {
      throw new Error(`Tried to call feature ${name} which doesn't exist or wasn't initiated`)
    }
    return feature.instance
  }

  destroy () {
    for (let availableFeature of availablesFeatures) {
      if (availableFeature.instance === undefined) continue
      this.logger(`Destroy feature ${availableFeature.name}`)
      availableFeature.instance.destroy()
    }
  }
}

module.exports = { getObjectAtPath, FeatureManager }
