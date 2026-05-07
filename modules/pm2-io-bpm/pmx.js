'use strict'

const Configuration = require('./configuration')
const Debug = require('debug')
const { ServiceManager } = require('./serviceManager')
const { createTransport } = require('./services/transport')
const { FeatureManager } = require('./featureManager')
const { ActionService } = require('./services/actions')
const { MetricService, MetricType, MetricMeasurements } = require('./services/metrics')
const Meter = require('./utils/metrics/meter')
const Histogram = require('./utils/metrics/histogram')
const Gauge = require('./utils/metrics/gauge')
const Counter = require('./utils/metrics/counter')
const { EventsFeature } = require('./features/events')
const { TracingFeature } = require('./features/tracing')
const { canUseInspector } = require('./constants')
const { RuntimeStatsService } = require('./services/runtimeStats')

const defaultConfig = {
  catchExceptions: true,
  profiling: true,
  metrics: {
    v8: true,
    network: false,
    eventLoop: true,
    runtime: true,
    http: true
  },
  standalone: false,
  apmOptions: undefined,
  tracing: {
    enabled: false,
    outbound: false
  }
}

class PMX {

  constructor () {
    this.initialConfig = undefined
    this.featureManager = new FeatureManager()
    this.transport = null
    this.actionService = null
    this.metricService = null
    this.runtimeStatsService = null
    this.logger = Debug('axm:main')
    this.initialized = false
  }

  /**
   * Init the APM instance, you should *always* init it before using any method
   */
  init (config) {
    const callsite = (new Error().stack || '').split('\n')[2]
    if (callsite && callsite.length > 0) {
      this.logger(`init from ${callsite}`)
    }

    if (this.initialized === true) {
      this.logger(`Calling init but was already the case, destroying and recreating`)
      this.destroy()
    }
    if (config === undefined) {
      config = defaultConfig
    }
    if (!config.standalone) {
      const autoStandalone = process.env.PM2_SECRET_KEY && process.env.PM2_PUBLIC_KEY && process.env.PM2_APP_NAME
      config.standalone = !!autoStandalone
      config.apmOptions = autoStandalone ? {
        secretKey: process.env.PM2_SECRET_KEY,
        publicKey: process.env.PM2_PUBLIC_KEY,
        appName: process.env.PM2_APP_NAME
      } : undefined
    }

    // Register the transport before any other service
    this.transport = createTransport(config.standalone === true ? 'websocket' : 'ipc', config.apmOptions)
    ServiceManager.set('transport', this.transport)

    if (canUseInspector()) {
      const Inspector = require('./services/inspector')
      const inspectorService = new Inspector()
      inspectorService.init()
      ServiceManager.set('inspector', inspectorService)
    }

    // register the action service
    this.actionService = new ActionService()
    this.actionService.init()
    ServiceManager.set('actions', this.actionService)

    // register the metric service
    this.metricService = new MetricService()
    this.metricService.init()
    ServiceManager.set('metrics', this.metricService)

    this.runtimeStatsService = new RuntimeStatsService()
    this.runtimeStatsService.init()
    if (this.runtimeStatsService.isEnabled()) {
      ServiceManager.set('runtimeStats', this.runtimeStatsService)
    }

    // init features
    this.featureManager.init(config)

    Configuration.init(config)
    // save the configuration
    this.initialConfig = config
    this.initialized = true

    return this
  }

  /**
   * Destroy the APM instance, every method will stop working afterwards
   */
  destroy () {
    this.logger('destroy')
    this.featureManager.destroy()

    if (this.actionService !== null) {
      this.actionService.destroy()
    }
    if (this.transport !== null) {
      this.transport.destroy()
    }
    if (this.metricService !== null) {
      this.metricService.destroy()
    }
    if (this.runtimeStatsService !== null) {
      this.runtimeStatsService.destroy()
    }
    const inspectorService = ServiceManager.get('inspector')
    if (inspectorService !== undefined) {
      inspectorService.destroy()
    }
  }

  /**
   * Fetch current configuration of the APM
   */
  getConfig () {
    return this.initialConfig
  }

  /**
   * Notify an error to PM2 Plus/Enterprise, note that you can attach a context to it
   * to provide more insight about the error
   */
  notifyError (error, context) {
    const notify = this.featureManager.get('notify')
    return notify.notifyError(error, context)
  }

  /**
   * Register metrics in bulk
   */
  metrics (metric) {

    const res = []
    if (metric === undefined || metric === null) {
      console.error(`Received empty metric to create`)
      console.trace()
      return []
    }

    let metrics = !Array.isArray(metric) ? [ metric ] : metric
    for (let metric of metrics) {
      if (typeof metric.name !== 'string') {
        console.error(`Trying to create a metrics without a name`, metric)
        console.trace()
        res.push({})
        continue
      }
      if (metric.type === undefined) {
        metric.type = MetricType.gauge
      }
      switch (metric.type) {
        case MetricType.counter : {
          res.push(this.counter(metric))
          continue
        }
        case MetricType.gauge : {
          res.push(this.gauge(metric))
          continue
        }
        case MetricType.histogram : {
          res.push(this.histogram(metric))
          continue
        }
        case MetricType.meter : {
          res.push(this.meter(metric))
          continue
        }
        case MetricType.metric : {
          res.push(this.gauge(metric))
          continue
        }
        default: {
          console.error(`Invalid metric type ${metric.type} for metric ${metric.name}`)
          console.trace()
          res.push({})
          continue
        }
      }
    }

    return res
  }

  /**
   * Create an histogram metric
   */
  histogram (config) {
    if (typeof config === 'string') {
      config = {
        name: config,
        measurement: MetricMeasurements.mean
      }
    }
    if (this.metricService === null) {
      return console.trace(`Tried to register a metric without initializing @pm2/io`)
    }

    return this.metricService.histogram(config)
  }

  /**
   * Create a gauge metric
   */
  metric (config) {
    if (typeof config === 'string') {
      config = {
        name: config
      }
    }
    if (this.metricService === null) {
      return console.trace(`Tried to register a metric without initializing @pm2/io`)
    }
    return this.metricService.metric(config)
  }

  /**
   * Create a gauge metric
   */
  gauge (config) {
    if (typeof config === 'string') {
      config = {
        name: config
      }
    }
    if (this.metricService === null) {
      return console.trace(`Tried to register a metric without initializing @pm2/io`)
    }
    return this.metricService.metric(config)
  }

  /**
   * Create a counter metric
   */
  counter (config) {
    if (typeof config === 'string') {
      config = {
        name: config
      }
    }
    if (this.metricService === null) {
      return console.trace(`Tried to register a metric without initializing @pm2/io`)
    }

    return this.metricService.counter(config)
  }

  /**
   * Create a meter metric
   */
  meter (config) {
    if (typeof config === 'string') {
      config = {
        name: config
      }
    }
    if (this.metricService === null) {
      return console.trace(`Tried to register a metric without initializing @pm2/io`)
    }

    return this.metricService.meter(config)
  }

  /**
   * Register a custom action that will be executed when the someone called
   * it from the API
   */
  action (name, opts, fn) {
    // backward compatiblity
    if (typeof name === 'object') {
      const tmp = name
      name = tmp.name
      opts = tmp.options
      fn = tmp.action
    }
    if (this.actionService === null) {
      return console.trace(`Tried to register a action without initializing @pm2/io`)
    }
    return this.actionService.registerAction(name, opts, fn)
  }

  onExit (callback) {
    if (typeof callback === 'function') {
      const handler = () => callback()
      process.on('exit', handler)
      process.on('SIGINT', () => { handler(); process.exit() })
      process.on('SIGTERM', () => { handler(); process.exit() })
    }
  }

  /**
   * Emit a custom event to Keymetrics
   * @deprecated
   *
   * The feature has been removed from PM2 Plus and will be removed in future release
   */
  emit (name, data) {
    const events = this.featureManager.get('events')
    return events.emit(name, data)
  }

  /**
   * Get the tracing agent to add more information about traces
   */
  getTracer () {
    const tracing = this.featureManager.get('tracing')
    return tracing.getTracer()
  }

  initModule (opts, cb) {
    if (!opts) opts = {}

    if (opts.reference) {
      opts.name = opts.reference
      delete opts.reference
    }

    opts = Object.assign({
      widget: {}
    }, opts)

    opts.widget = Object.assign({
      type : 'generic',
      logo : 'https://app.keymetrics.io/img/logo/keymetrics-300.png',
      theme            : ['#111111', '#1B2228', '#807C7C', '#807C7C']
    }, opts.widget)

    opts.isModule = true
    opts = Configuration.init(opts)

    return typeof cb === 'function' ? cb(null, opts) : opts
  }

  /**
   * Return a custom express middleware that will send an error to the backend
   * with all the details of the http request
   */
  expressErrorHandler () {
    const notify = this.featureManager.get('notify')
    return notify.expressErrorHandler()
  }

  /**
   * Return a custom koa middleware that will send an error to the backend
   * with all the details of the http request
   */
  koaErrorHandler () {
    const notify = this.featureManager.get('notify')
    return notify.koaErrorHandler()
  }
}

module.exports = PMX
module.exports.defaultConfig = defaultConfig
