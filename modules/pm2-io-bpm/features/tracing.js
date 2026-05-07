'use strict'

const Debug = require('debug')
const Configuration = require('../configuration')

const httpMethodToIgnore = [
  'options',
  'head'
]

const defaultTracingConfig = {
  enabled: true,
  outbound: false,
  samplingRate: 0,
  ignoreIncomingPaths: [],
  ignoreOutgoingUrls: [],
  createSpanWithNet: false
}

const enabledTracingConfig = {
  enabled: true,
  outbound: true,
  samplingRate: 0.5,
  ignoreIncomingPaths: [
    (_url, request) => {
      const method = (request.method || 'GET').toLowerCase()
      return httpMethodToIgnore.indexOf(method) > -1
    },
    /(.*).js/,
    /(.*).css/,
    /(.*).png/,
    /(.*).ico/,
    /(.*).svg/,
    /webpack/
  ],
  ignoreOutgoingUrls: [],
  createSpanWithNet: false
}

class TracingFeature {
  constructor () {
    this.options = null
    this.logger = Debug('axm:tracing')
    this.otel = undefined
  }

  init (config) {
    this.logger('init tracing', config)

    if (config.tracing === undefined) {
      config.tracing = defaultTracingConfig
    } else if (config.tracing === true) {
      config.tracing = enabledTracingConfig
    } else if (config.tracing === false) {
      config.tracing = defaultTracingConfig
    }

    if (config.tracing.enabled === false) {
      this.logger('tracing disabled')
      return
    } else {
      this.logger('tracing enabled')
    }

    this.options = enabledTracingConfig

    if (typeof config.apmOptions === 'object' && typeof config.apmOptions.appName === 'string') {
      this.options.serviceName = config.apmOptions.appName
    } else if (typeof process.env.name === 'string') {
      this.options.serviceName = process.env.name
    }

    if (config.tracing.ignoreOutgoingUrls === undefined) {
      config.tracing.ignoreOutgoingUrls = enabledTracingConfig.ignoreOutgoingUrls
    }

    if (config.tracing.ignoreIncomingPaths === undefined) {
      config.tracing.ignoreIncomingPaths = enabledTracingConfig.ignoreIncomingPaths
    }

    let NodeSDK, getNodeAutoInstrumentations, CustomZipkinExporter
    try {
      NodeSDK = require('@opentelemetry/sdk-node').NodeSDK
      getNodeAutoInstrumentations = require('@opentelemetry/auto-instrumentations-node').getNodeAutoInstrumentations
      CustomZipkinExporter = require('../otel/custom-zipkin-exporter/zipkin').CustomZipkinExporter
    } catch(e) {
      console.error('[PM2][ERROR] OpenTelemetry packages not installed. Tracing disabled.')
      console.error('[PM2][ERROR] To enable tracing, run: pm2 install-otel')
      return
    }

    const traceExporter = new CustomZipkinExporter()

    const serviceName =
      process.env.OTEL_SERVICE_NAME ||
        this.options.serviceName

    this.otel = new NodeSDK({
      traceExporter,
      serviceName,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-dns': {
            enabled: false
          },
          '@opentelemetry/instrumentation-fs': {
            enabled: false
          },
          '@opentelemetry/instrumentation-net': {
            enabled: this.options.createSpanWithNet
          },
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (request) => {
              if (!this.options.ignoreIncomingPaths) {
                return false
              }
              return this.options.ignoreIncomingPaths.some((matcher) => applyMatcher(matcher, request))
            },
            ignoreOutgoingRequestHook: (request) => {
              if (!this.options.ignoreOutgoingUrls) {
                return false
              }
              return this.options.ignoreOutgoingUrls.some((matcher) => applyMatcher(matcher, request))
            }
          }
        })
      ]
    })

    this.otel.start()

    Configuration.configureModule({
      otel_tracing: true
    })
  }

  getTracer () {
    if (!this.options.serviceName) {
      throw new Error('serviceName is required')
    }
    const { trace } = require('@opentelemetry/api')
    return trace.getTracer(this.options.serviceName)
  }

  destroy () {
    if (!this.otel) return
    this.logger('stop otel tracer')
    this.otel.shutdown()

    Configuration.configureModule({
      otel_tracing: false
    })
  }
}

function applyMatcher (matcher, request) {
  if (!matcher) {
    return false
  }
  if (!request.url) {
    return false
  }

  if (typeof matcher === 'string') {
    return request.url.includes(matcher)
  }
  if (matcher instanceof RegExp) {
    return matcher.test(request.url)
  }

  return matcher(request.url, request)
}

module.exports = { TracingFeature }
