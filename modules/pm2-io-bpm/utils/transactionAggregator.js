'use strict'

const { EventEmitter } = require('events')
const Debug = require('debug')
const EWMA = require('./EWMA')
const Histogram = require('./metrics/histogram')

const fclone = (data) => JSON.parse(JSON.stringify(data))
const log = Debug('axm:features:tracing:aggregator')

class TransactionAggregator extends EventEmitter {
  constructor () {
    super()

    this._spanTypes = ['redis', 'mysql', 'pg', 'mongo', 'outbound_http']
    this._cache = {
      routes: {},
      meta: {
        trace_count: 0,
        http_meter: new EWMA(),
        db_meter: new EWMA(),
        histogram: new Histogram({ measurement: 'median' }),
        db_histograms: {}
      }
    }
    this._privacyRegex = /":(?!\[|{)\\"[^"]*\\"|":(["'])(?:(?=(\\?))\2.)*?\1|":(?!\[|{)[^,}\]]*|":\[[^{]*]/g
    this._worker = undefined
  }

  init (sendInterval) {
    sendInterval = sendInterval || 30000
    this._worker = setInterval(_ => {
      let data = this.prepareAggregationforShipping()
      this.emit('packet', { data })
    }, sendInterval)
  }

  destroy () {
    if (this._worker !== undefined) {
      clearInterval(this._worker)
    }
    this._cache.routes = {}
  }

  getAggregation () {
    return this._cache
  }

  validateData (packet) {
    if (!packet) {
      log('Packet malformated', packet)
      return false
    }

    if (!packet.spans || !packet.spans[0]) {
      log('Trace without spans: %s', Object.keys(packet.data))
      return false
    }

    if (!packet.spans[0].labels) {
      log('Trace spans without labels: %s', Object.keys(packet.spans))
      return false
    }

    return true
  }

  /**
   * Main method to aggregate and compute stats for traces
   *
   * @param {Object} packet
   */
  aggregate (packet) {
    if (this.validateData(packet) === false) return false

    // Get http path of current span
    let path = packet.spans[0].labels['http/path']
    // Cleanup spans
    if (process.env.PM2_APM_CENSOR_SPAMS !== '0') {
      this.censorSpans(packet.spans)
    }

    // remove spans with startTime == endTime
    packet.spans = packet.spans.filter((span) => {
      return span.endTime !== span.startTime
    })

    // compute duration of child spans
    packet.spans.forEach((span) => {
      span.mean = Math.round(new Date(span.endTime).getTime() - new Date(span.startTime).getTime())
      delete span.endTime
    })

    // Update app meta (mean_latency, http_meter, db_meter, trace_count)
    packet.spans.forEach((span) => {
      if (!span.name || !span.kind) return false

      if (span.kind === 'RPC_SERVER') {
        this._cache.meta.histogram.update(span.mean)
        return this._cache.meta.http_meter.update(1)
      }

      // Override outbount http queries for processing
      if (span.labels && span.labels['http/method'] && span.labels['http/status_code']) {
        span.labels['service'] = span.name
        span.name = 'outbound_http'
      }

      for (let i = 0; i < this._spanTypes.length; i++) {
        if (span.name.indexOf(this._spanTypes[i]) > -1) {
          this._cache.meta.db_meter.update(1)
          if (!this._cache.meta.db_histograms[this._spanTypes[i]]) {
            this._cache.meta.db_histograms[this._spanTypes[i]] = new Histogram({ measurement: 'mean' })
          }
          this._cache.meta.db_histograms[this._spanTypes[i]].update(span.mean)
          break
        }
      }
    })

    this._cache.meta.trace_count++

    /**
     * Handle traces aggregation
     */
    if (path[0] === '/' && path !== '/') {
      path = path.substr(1, path.length - 1)
    }

    let matched = this.matchPath(path, this._cache.routes)

    if (!matched) {
      this._cache.routes[path] = []
      this.mergeTrace(this._cache.routes[path], packet)
    } else {
      this.mergeTrace(this._cache.routes[matched], packet)
    }

    return this._cache
  }

  /**
   * Merge new trace and compute mean, min, max, count
   *
   * @param {Object}  aggregated previous aggregated route
   * @param {Object}  trace
   */
  mergeTrace (aggregated, trace) {
    if (!aggregated || !trace) return

    // if the trace doesn't any spans stop aggregation here
    if (trace.spans.length === 0) return

    // create data structure if needed
    if (!aggregated.variances) aggregated.variances = []
    if (!aggregated.meta) {
      aggregated.meta = {
        histogram: new Histogram({ measurement: 'median' }),
        meter: new EWMA()
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
        // this.parseStacktrace(trace.spans)
        aggregated.variances.push(trace)
      } else {
        // variance found, merge spans
        variance.histogram.update(trace.spans[0].mean)

        // update duration of spans to be mean
        this.updateSpanDuration(variance.spans, trace.spans)

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
    for (let i = 0; i < spans.length; i++) {
      if (!newSpans[i]) continue
      spans[i].histogram.update(newSpans[i].mean)
    }
  }

  /**
   * Compare two spans list by going down on each span and comparing child and attribute
   */
  compareList (one, two) {
    if (one.length !== two.length) return false

    for (let i = 0; i < one.length; i++) {
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
    for (let i = 0; i < keys.length; i++) {
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

  /**
   * Normalize aggregation
   */
  prepareAggregationforShipping () {
    let routes = this._cache.routes

    const normalized = {
      routes: [],
      meta: {
        trace_count: this._cache.meta.trace_count,
        http_meter: Math.round(this._cache.meta.http_meter.rate(1000) * 100) / 100,
        db_meter: Math.round(this._cache.meta.db_meter.rate(1000) * 100) / 100,
        http_percentiles: {
          median: this._cache.meta.histogram.percentiles([0.5])[0.5],
          p95: this._cache.meta.histogram.percentiles([0.95])[0.95],
          p99: this._cache.meta.histogram.percentiles([0.99])[0.99]
        },
        db_percentiles: {}
      }
    }

    // compute percentiles for each db spans if they exist
    this._spanTypes.forEach((name) => {
      let histogram = this._cache.meta.db_histograms[name]
      if (!histogram) return
      normalized.meta.db_percentiles[name] = histogram.percentiles([0.5])[0.5]
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
        meta: {
          min: data.meta.histogram.getMin(),
          max: data.meta.histogram.getMax(),
          count: data.meta.histogram.getCount(),
          meter: Math.round(data.meta.meter.rate(1000) * 100) / 100,
          median: data.meta.histogram.percentiles([0.5])[0.5],
          p95: data.meta.histogram.percentiles([0.95])[0.95]
        },
        variances: []
      }

      variances.forEach((variance) => {
        // hard check for invalid data
        if (!variance.spans || variance.spans.length === 0) return

        // deep copy of variances data
        let tmp = {
          spans: [],
          count: variance.histogram.getCount(),
          min: variance.histogram.getMin(),
          max: variance.histogram.getMax(),
          median: variance.histogram.percentiles([0.5])[0.5],
          p95: variance.histogram.percentiles([0.95])[0.95]
        }

        // get data for each span
        variance.spans.forEach((oldSpan) => {
          const span = fclone({
            name: oldSpan.name,
            labels: oldSpan.labels,
            kind: oldSpan.kind,
            startTime: oldSpan.startTime,
            min: oldSpan.histogram ? oldSpan.histogram.getMin() : undefined,
            max: oldSpan.histogram ? oldSpan.histogram.getMax() : undefined,
            median: oldSpan.histogram ? oldSpan.histogram.percentiles([0.5])[0.5] : undefined
          })
          tmp.spans.push(span)
        })
        // push serialized into normalized data
        routeCopy.variances.push(tmp)
      })
      // push the route into normalized data
      normalized.routes.push(routeCopy)
    })
    log(`sending formatted trace to remote endpoint`)
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

    spans.forEach((span) => {
      if (!span.labels) return

      delete span.labels.results
      delete span.labels.result
      delete span.spanId
      delete span.parentSpanId
      delete span.labels.values
      delete span.labels.stacktrace

      Object.keys(span.labels).forEach((key) => {
        if (typeof (span.labels[key]) === 'string' && key !== 'stacktrace') {
          span.labels[key] = span.labels[key].replace(this._privacyRegex, '\": \"?\"')
        }
      })
    })
  }
}

module.exports = { TransactionAggregator }
