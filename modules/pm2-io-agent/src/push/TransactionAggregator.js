'use strict'

const cst = require('../../constants.js')
const log = require('debug')('interactor:aggregator')
const Utility = require('../Utility.js')
const fclone = require('../../../fclone')
const Histogram = require('../utils/probes/Histogram')

/**
 *
 * # Data structure sent to interactor
 *
 * {
 *  'process_name': {
 *    process : {},         // PM2 process meta data
 *    data : {
 *      routes : [          // array of all routes ordered by count
 *        {
 *          path: '/',       // path of the route
 *          meta: {
 *            count: 50,     // count of this route
 *            max: 300,      // max latency of this route
 *            min: 50,       // min latency of this route
 *            mean: 120      // mean latency of this route
 *          }
 *          variances:  [{  // array of variance order by count
 *           spans : [
 *              ...         // transactions
 *           ],
 *           count: 50,     // count of this variance
 *           max: 300,      // max latency of this variance
 *           min: 50,       // min latency of this variance
 *           mean: 120      // mean latency of this variance
 *          }]
 *        }
 *      ],
 *      meta : {
 *        trace_count : 50,  // trace number
 *        mean_latency      : 40,  // global app latency in ms
 *        http_meter        : 30,  // global app req per minutes
 *        db_meter          : 20,  // number of database transaction per min
 *      }
 *    }
 *   }
 * }
 */

module.exports = class TransactionAggregator {
  constructor (pushInteractor) {
    this.processes = {}
    this.stackParser = pushInteractor._stackParser
    this.pushInteractor = pushInteractor

    this.LABELS = {
      'HTTP_RESPONSE_CODE_LABEL_KEY': 'http/status_code',
      'HTTP_URL_LABEL_KEY': 'http/url',
      'HTTP_METHOD_LABEL_KEY': 'http/method',
      'HTTP_RESPONSE_SIZE_LABEL_KEY': 'http/response/size',
      'STACK_TRACE_DETAILS_KEY': 'stacktrace',
      'ERROR_DETAILS_NAME': 'error/name',
      'ERROR_DETAILS_MESSAGE': 'error/message',
      'HTTP_SOURCE_IP': 'http/source/ip',
      'HTTP_PATH_LABEL_KEY': 'http/path'
    }
    this.SPANS_DB = ['redis', 'mysql', 'pg', 'mongo', 'outbound_http']
    this.REGEX_JSON_CLEANUP = /":(?!\[|{)\\"[^"]*\\"|":(["'])(?:(?=(\\?))\2.)*?\1|":(?!\[|{)[^,}\]]*|":\[[^{]*]/g

    this.init()
  }

  /**
   * First method to call in real environment
   * - Listen to restart event for initialization period
   * - Clear aggregation on process stop
   * - Launch worker to attach data to be pushed to KM
   */
  init () {
    // New Process Online, reset & wait a bit before processing
    this.pushInteractor._ipm2.bus.on('process:event', (data) => {
      if (data.event !== 'online' || !this.processes[data.process.name]) return false

      let rev = (data.process.versioning && data.process.versioning.revision)
        ? data.process.versioning.revision : null

      this.resetAggregation(data.process.name, {
        rev: rev,
        server: this.pushInteractor.opts.MACHINE_NAME
      })
    })

    // Process getting offline, delete aggregation
    this.pushInteractor._ipm2.bus.on('process:event', (data) => {
      if (data.event !== 'stop' || !this.processes[data.process.name]) return false
      log('Deleting aggregation for %s', data.process.name)
      delete this.processes[data.process.name]
    })

    this.launchWorker()
  }

  /**
   * Reset aggregation for target app_name
   */
  resetAggregation (appName, meta) {
    log('Reseting agg for app:%s meta:%j', appName, meta)

    if (this.processes[appName].initialization_timeout) {
      log('Reseting initialization timeout app:%s', appName)
      clearTimeout(this.processes[appName].initialization_timeout)
      clearInterval(this.processes[appName].notifier)
      this.processes[appName].notifier = null
    }

    this.processes[appName] = this.initializeRouteMeta({
      name: appName,
      rev: meta.rev,
      server: meta.server
    })

    let start = Date.now()
    this.processes[appName].notifier = setInterval(_ => {
      let elapsed = Date.now() - start
      // failsafe
      if (elapsed / 1000 > cst.AGGREGATION_DURATION) {
        clearInterval(this.processes[appName].notifier)
        this.processes[appName].notifier = null
      }

      let msg = {
        data: {
          learning_duration: cst.AGGREGATION_DURATION,
          elapsed: elapsed
        },
        process: this.processes[appName].process
      }
      this.pushInteractor && this.pushInteractor.transport.send('axm:transaction:learning', msg)
    }, 5000)

    this.processes[appName].initialization_timeout = setTimeout(_ => {
      log('Initialization timeout finished for app:%s', appName)
      clearInterval(this.processes[appName].notifier)
      this.processes[appName].notifier = null
      this.processes[appName].initialization_timeout = null
    }, cst.AGGREGATION_DURATION)
  }

  /**
   * Clear aggregated data for all process
   */
  clearData () {
    Object.keys(this.processes).forEach((process) => {
      this.resetAggregation(process, this.processes[process].process)
    })
  }

  /**
   * Generate new entry for application
   *
   * @param {Object} process process meta
   */
  initializeRouteMeta (process) {
    if (process.pm_id) delete process.pm_id

    return {
      routes: {},
      meta: {
        trace_count: 0,
        http_meter: new Utility.EWMA(),
        db_meter: new Utility.EWMA(),
        histogram: new Histogram({ measurement: 'median' }),
        db_histograms: {}
      },
      process: process
    }
  }

  getAggregation () {
    return this.processes
  }

  validateData (packet) {
    if (!packet || !packet.data) {
      log('Packet malformated', packet)
      return false
    }

    if (!packet.process) {
      log('Got packet without process: %j', packet)
      return false
    }

    if (!packet.data.spans || !packet.data.spans[0]) {
      log('Trace without spans: %s', Object.keys(packet.data))
      return false
    }

    if (!packet.data.spans[0].labels) {
      log('Trace spans without labels: %s', Object.keys(packet.data.spans))
      return false
    }

    return true
  }

  /**
   * Main method to aggregate and compute stats for traces
   *
   * @param {Object} packet
   * @param {Object} packet.process  process metadata
   * @param {Object} packet.data     trace
   */
  aggregate (packet) {
    if (this.validateData(packet) === false) return false

    const newTrace = packet.data
    const appName = packet.process.name

    if (!this.processes[appName]) {
      this.processes[appName] = this.initializeRouteMeta(packet.process)
    }

    let process = this.processes[appName]

    // Get http path of current span
    let path = newTrace.spans[0].labels[this.LABELS.HTTP_PATH_LABEL_KEY]
    if (!path) return false

    // Cleanup spans
    this.censorSpans(newTrace.spans)

    // remove spans with startTime == endTime
    newTrace.spans = newTrace.spans.filter((span) => {
      return span.endTime !== span.startTime
    })

    // compute duration of child spans
    newTrace.spans.forEach((span) => {
      span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime))
      delete span.endTime
    })

    // Update app meta (mean_latency, http_meter, db_meter, trace_count)
    newTrace.spans.forEach((span) => {
      if (!span.name || !span.kind) return false

      if (span.kind === 'RPC_SERVER') {
        process.meta.histogram.update(span.mean)
        return process.meta.http_meter.update()
      }

      // Override outbount http queries for processing
      if (span.labels && span.labels['http/method'] && span.labels['http/status_code']) {
        span.labels['service'] = span.name
        span.name = 'outbound_http'
      }

      for (let i = 0, len = this.SPANS_DB.length; i < len; i++) {
        if (span.name.indexOf(this.SPANS_DB[i]) > -1) {
          process.meta.db_meter.update()
          if (!process.meta.db_histograms[this.SPANS_DB[i]]) {
            process.meta.db_histograms[this.SPANS_DB[i]] = new Histogram({ measurement: 'mean' })
          }
          process.meta.db_histograms[this.SPANS_DB[i]].update(span.mean)
          break
        }
      }
    })

    process.meta.trace_count++

    /**
     * Handle traces aggregation
     */
    if (path[0] === '/' && path !== '/') {
      path = path.substr(1, path.length - 1)
    }

    let matched = this.matchPath(path, process.routes)

    if (!matched) {
      process.routes[path] = []
      this.mergeTrace(process.routes[path], newTrace, process)
    } else {
      this.mergeTrace(process.routes[matched], newTrace, process)
    }

    return this.processes
  }

  /**
   * Merge new trace and compute mean, min, max, count
   *
   * @param {Object}  aggregated previous aggregated route
   * @param {Object}  trace
   */
  mergeTrace (aggregated, trace, process) {
    if (!aggregated || !trace) return

    // if the trace doesn't any spans stop aggregation here
    if (trace.spans.length === 0) return

    // create data structure if needed
    if (!aggregated.variances) aggregated.variances = []
    if (!aggregated.meta) {
      aggregated.meta = {
        histogram: new Histogram({ measurement: 'median' }),
        meter: new Utility.EWMA()
      }
    }

    aggregated.meta.histogram.update(trace.spans[0].mean)
    aggregated.meta.meter.update()

    const merge = (variance) => {
      // no variance found so its a new one
      if (variance == null) {
        delete trace.projectId
        delete trace.traceId
        trace.histogram = new Histogram({ measurement: 'median' })
        trace.histogram.update(trace.spans[0].mean)

        trace.spans.forEach((span) => {
          span.histogram = new Histogram({ measurement: 'median' })
          span.histogram.update(span.mean)
          delete span.mean
        })

        // parse strackrace
        this.parseStacktrace(trace.spans)
        aggregated.variances.push(trace)
      } else {
        // check to see if request is anormally slow, if yes send it as inquisitor
        if (trace.spans[0].mean > variance.histogram.percentiles([0.95])[0.95] &&
          typeof pushInteractor !== 'undefined' && !process.initialization_timeout) {
          // serialize and add metadata
          this.parseStacktrace(trace.spans)
          let data = {
            trace: fclone(trace.spans),
            variance: fclone(variance.spans.map((span) => {
              return {
                labels: span.labels,
                kind: span.kind,
                name: span.name,
                startTime: span.startTime,
                percentiles: {
                  p5: variance.histogram.percentiles([0.5])[0.5],
                  p95: variance.histogram.percentiles([0.95])[0.95]
                }
              }
            })),
            meta: {
              value: trace.spans[0].mean,
              percentiles: {
                p5: variance.histogram.percentiles([0.5])[0.5],
                p75: variance.histogram.percentiles([0.75])[0.75],
                p95: variance.histogram.percentiles([0.95])[0.95],
                p99: variance.histogram.percentiles([0.99])[0.99]
              },
              min: variance.histogram.getMin(),
              max: variance.histogram.getMax(),
              count: variance.histogram.getCount()
            },
            process: process.process
          }
          this.pushInteractor.transport.send('axm:transaction:outlier', data)
        }

        // variance found, merge spans
        variance.histogram.update(trace.spans[0].mean)

        // update duration of spans to be mean
        this.updateSpanDuration(variance.spans, trace.spans, variance.count)

        // delete stacktrace before merging
        trace.spans.forEach((span) => {
          delete span.labels.stacktrace
        })
      }
    }

    // for every variance, check spans same variance
    for (let i = 0; i < aggregated.variances.length; i++) {
      if (this.compareList(aggregated.variances[i].spans, trace.spans)) {
        return merge(aggregated.variances[i])
      }
    }
    // else its a new variance
    return merge(null)
  }

  /**
   * Parkour simultaneously both spans list to update value of the first one using value of the second one
   * The first should be variance already aggregated for which we want to merge the second one
   * The second one is a new trace, so we need to re-compute mean/min/max time for each spans
   */
  updateSpanDuration (spans, newSpans) {
    for (let i = 0, len = spans.length; i < len; i++) {
      if (!newSpans[i]) continue
      spans[i].histogram.update(newSpans[i].mean)
    }
  }

  /**
   * Compare two spans list by going down on each span and comparing child and attribute
   */
  compareList (one, two) {
    if (one.length !== two.length) return false

    for (let i = 0, len = one; i < len; i++) {
      if (one[i].name !== two[i].name) return false
      if (one[i].kind !== two[i].kind) return false
      if (!one[i].labels && two[i].labels) return false
      if (one[i].labels && !two[i].labels) return false
      if (one[i].labels.length !== two[i].labels.length) return false
    }
    return true
  }

  /**
   * Will return the route if we found an already matched route
   */
  matchPath (path, routes) {
    // empty route is / without the fist slash
    if (!path || !routes) return false
    if (path === '/') return routes[path] ? path : null

    // remove the last slash if exist
    if (path[path.length - 1] === '/') {
      path = path.substr(0, path.length - 1)
    }

    // split to get array of segment
    path = path.split('/')

    // if the path has only one segment, we just need to compare the key
    if (path.length === 1) return routes[path[0]] ? routes[path[0]] : null

    // check in routes already stored for match
    let keys = Object.keys(routes)
    for (let i = 0, len = keys.length; i < len; i++) {
      let route = keys[i]
      let segments = route.split('/')

      if (segments.length !== path.length) continue

      for (let j = path.length - 1; j >= 0; j--) {
        // different segment, try to find if new route or not
        if (path[j] !== segments[j]) {
          // if the aggregator already have matched that segment with a wildcard and the next segment is the same
          if (this.isIdentifier(path[j]) && segments[j] === '*' && path[j - 1] === segments[j - 1]) {
            return segments.join('/')
          // case a let in url match, so we continue because they must be other let in url
          } else if (path[j - 1] !== undefined && path[j - 1] === segments[j - 1] && this.isIdentifier(path[j]) && this.isIdentifier(segments[j])) {
            segments[j] = '*'
            // update routes in cache
            routes[segments.join('/')] = routes[route]
            delete routes[keys[i]]
            return segments.join('/')
          } else {
            break
          }
        }

        // if finish to iterate over segment of path, we must be on the same route
        if (j === 0) return segments.join('/')
      }
    }
  }

  launchWorker () {
    this._worker = setInterval(_ => {
      let normalized = this.prepareAggregationforShipping()
      Object.keys(normalized).forEach((key) => {
        this.pushInteractor.transport.send('axm:transaction', normalized[key])
      })
    }, cst.TRACE_FLUSH_INTERVAL)
  }

  /**
   * Normalize aggregation
   */
  prepareAggregationforShipping () {
    let normalized = {}

    // Iterate each applications
    Object.keys(this.processes).forEach((appName) => {
      let process = this.processes[appName]
      let routes = process.routes

      if (process.initialization_timeout) {
        log('Waiting for app %s to be initialized', appName)
        return null
      }

      normalized[appName] = {
        data: {
          routes: [],
          meta: fclone({
            trace_count: process.meta.trace_count,
            http_meter: Math.round(process.meta.http_meter.rate(1000) * 100) / 100,
            db_meter: Math.round(process.meta.db_meter.rate(1000) * 100) / 100,
            http_percentiles: {
              median: process.meta.histogram.percentiles([0.5])[0.5],
              p95: process.meta.histogram.percentiles([0.95])[0.95],
              p99: process.meta.histogram.percentiles([0.99])[0.99]
            },
            db_percentiles: {}
          })
        },
        process: process.process
      }

      // compute percentiles for each db spans if they exist
      this.SPANS_DB.forEach((name) => {
        let histogram = process.meta.db_histograms[name]
        if (!histogram) return
        normalized[appName].data.meta.db_percentiles[name] = fclone(histogram.percentiles([0.5])[0.5])
      })

      Object.keys(routes).forEach((path) => {
        let data = routes[path]

        // hard check for invalid data
        if (!data.variances || data.variances.length === 0) return

        // get top 5 variances of the same route
        const variances = data.variances.sort((a, b) => {
          return b.count - a.count
        }).slice(0, 5)

        // create a copy without reference to stored one
        let routeCopy = {
          path: path === '/' ? '/' : '/' + path,
          meta: fclone({
            min: data.meta.histogram.getMin(),
            max: data.meta.histogram.getMax(),
            count: data.meta.histogram.getCount(),
            meter: Math.round(data.meta.meter.rate(1000) * 100) / 100,
            median: data.meta.histogram.percentiles([0.5])[0.5],
            p95: data.meta.histogram.percentiles([0.95])[0.95]
          }),
          variances: []
        }

        variances.forEach((variance) => {
          // hard check for invalid data
          if (!variance.spans || variance.spans.length === 0) return

          // deep copy of variances data
          let tmp = fclone({
            spans: [],
            count: variance.histogram.getCount(),
            min: variance.histogram.getMin(),
            max: variance.histogram.getMax(),
            median: variance.histogram.percentiles([0.5])[0.5],
            p95: variance.histogram.percentiles([0.95])[0.95]
          })

          // get data for each span
          variance.spans.forEach((span) => {
            tmp.spans.push(fclone({
              name: span.name,
              labels: span.labels,
              kind: span.kind,
              startTime: span.startTime,
              min: span.histogram.getMin(),
              max: span.histogram.getMax(),
              median: span.histogram.percentiles([0.5])[0.5]
            }))
          })
          // push serialized into normalized data
          routeCopy.variances.push(tmp)
        })
        // push the route into normalized data
        normalized[appName].data.routes.push(routeCopy)
      })
    })

    return normalized
  }

  /**
   * Check if the string can be a id of some sort
   *
   * @param {String} id
   */
  isIdentifier (id) {
    id = typeof (id) !== 'string' ? id + '' : id

    // uuid v1/v4 with/without dash
    if (id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[14][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{12}[14][0-9a-f]{19}/i)) {
      return true
    // if number
    } else if (id.match(/\d+/)) {
      return true
    // if suit of nbr/letters
    } else if (id.match(/[0-9]+[a-z]+|[a-z]+[0-9]+/)) {
      return true
    // if match pattern with multiple char spaced by . - _ @
    } else if (id.match(/((?:[0-9a-zA-Z]+[@\-_.][0-9a-zA-Z]+|[0-9a-zA-Z]+[@\-_.]|[@\-_.][0-9a-zA-Z]+)+)/)) {
      return true
    }
    return false
  }

  /**
   * Cleanup trace data
   * - delete result(s)
   * - replace labels value with a question mark
   *
   * @param {Object} spans list of span for a trace
   */
  censorSpans (spans) {
    if (!spans) return log('spans is null')
    if (cst.DEBUG) return

    spans.forEach((span) => {
      if (!span.labels) return

      delete span.labels.results
      delete span.labels.result
      delete span.spanId
      delete span.parentSpanId
      delete span.labels.values

      Object.keys(span.labels).forEach((key) => {
        if (typeof (span.labels[key]) === 'string' && key !== 'stacktrace') {
          span.labels[key] = span.labels[key].replace(this.REGEX_JSON_CLEANUP, '\": \"?\"') // eslint-disable-line
        }
      })
    })
  }

  /**
   * Parse stackrace of spans to extract and normalize data
   *
   * @param {Object} spans list of span for a trace
   */
  parseStacktrace (spans) {
    if (!spans) return log('spans is null')

    spans.forEach((span) => {
      // if empty make sure that it doesnt exist
      if (!span ||
          !span.labels ||
          !span.labels.stacktrace ||
          typeof (span.labels.stacktrace) !== 'string') return

      // you never know what come through that door
      try {
        span.labels.stacktrace = JSON.parse(span.labels.stacktrace)
      } catch (e) {
        return
      }

      if (!span.labels.stacktrace || !(span.labels.stacktrace.stack_frame instanceof Array)) return
      // parse the stacktrace
      let result = this.stackParser.parse(span.labels.stacktrace.stack_frame)
      if (result) {
        span.labels['source/file'] = result.callsite || undefined
        span.labels['source/context'] = result.context || undefined
      }
    })

    spans.forEach((span) => {
      if (!span || !span.labels) return
      delete span.labels.stacktrace
    })
  }
}
