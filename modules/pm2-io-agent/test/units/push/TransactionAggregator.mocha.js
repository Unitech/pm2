/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const Aggregator = require('../../../src/push/TransactionAggregator.js')
const Utility = require('../../../src/Utility.js')
const TraceFactory = require('../../misc/trace_factory.js')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

describe('Transactions Aggregator', function () {
  let aggregator
  let stackParser

  it('should instanciate context cache', function () {
    let cache = new Utility.Cache({
      miss: function (key) {
        try {
          let content = fs.readFileSync(path.resolve(key))
          return content.toString().split(/\r?\n/)
        } catch (err) {
          return undefined
        }
      }
    })

    stackParser = new Utility.StackTraceParser({ cache: cache, context: 2 })
  })

  it('should instanciate aggregator', function () {
    aggregator = new Aggregator({ _stackParser: stackParser, _ipm2: {bus: {on: _ => {}}} })
  })

  describe('.censorSpans', function () {
    let trace = TraceFactory.generateTrace('/yoloswag/swag', 2)

    it('should not fail', function () {
      aggregator.censorSpans(null)
    })

    it('should censor span', function () {
      assert(trace.spans[1].labels.results !== undefined)
      aggregator.censorSpans(trace.spans)
      assert(trace.spans[1].labels.results === undefined)
      assert(trace.spans[1].labels.cmd.indexOf('?') > -1)
    })
  })

  describe('.isIdentifier', function () {
    it('should be an identifier (api version)', function () {
      assert(aggregator.isIdentifier('v1'))
    })

    it('should be an identifier (number)', function () {
      assert(aggregator.isIdentifier('123'))
    })

    it('should be an identifier (random str)', function () {
      assert(aggregator.isIdentifier('65f4ez656'))
    })

    it('should be an identifier (uuid)', function () {
      assert(aggregator.isIdentifier('123e4567-e89b-12d3-a456-426655440000'))
      assert(aggregator.isIdentifier('123e4567e89b12d3a456426655440000'))
    })

    it('should be an identifier', function () {
      assert(aggregator.isIdentifier('toto-toto-tooa'))
      assert(aggregator.isIdentifier('toto@toto.fr'))
      assert(aggregator.isIdentifier('toto@toto.fr'))
      assert(aggregator.isIdentifier('fontawesome-webfont.eot'))
      assert(aggregator.isIdentifier('life_is_just_fantasy'))
      assert(aggregator.isIdentifier('OR-IS_THIS-REAL_LIFE'))
    })

    it('should be NOT an identifier', function () {
      assert(!aggregator.isIdentifier('bucket'))
      assert(!aggregator.isIdentifier('admin'))
      assert(!aggregator.isIdentifier('auth'))
      assert(!aggregator.isIdentifier('users'))
      assert(!aggregator.isIdentifier('version'))
    })
  })

  describe('.matchPath - aggregate', function () {
    let routes = {
      'bucket/6465577': { spans: true }
    }

    it('should not fail', function () {
      aggregator.matchPath()
      aggregator.matchPath('/')
      aggregator.matchPath('/', {})
      aggregator.matchPath('/', {
        '/': {}
      })
    })

    it('should match first route', function () {
      let match = aggregator.matchPath('bucket/67754', routes)
      assert(match !== undefined)
      assert(typeof match === 'string')
      assert(match === 'bucket/*')
      assert(routes['bucket/*'] !== undefined)
    })

    it('should NOT match any route', function () {
      assert(aggregator.matchPath('toto/67754', routes) === undefined)
    })

    it('should match aggregated route with *', function () {
      let match = aggregator.matchPath('bucket/87998', routes)
      assert(match !== undefined)
      assert(typeof match === 'string')
      assert(match === 'bucket/*')
      assert(routes['bucket/*'] !== undefined)
    })
  })

  describe('merging trace together', function () {
    let trace = TraceFactory.generateTrace('yoloswag/swag', 2)
    let ROUTES = {
      'yoloswag/swag': {}
    }

    it('should not fail', function () {
      aggregator.mergeTrace()
      aggregator.mergeTrace(null, trace)
      aggregator.mergeTrace({}, trace)
      aggregator.mergeTrace({})
    })

    it('should add a trace', function () {
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace)
      assert(ROUTES['yoloswag/swag'].meta.histogram.getCount() === 1)
      assert(ROUTES['yoloswag/swag'].variances.length === 1)
      assert(ROUTES['yoloswag/swag'].variances[0].spans.length === 3)
    })

    it('should merge with the first variance', function () {
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace)
      assert(ROUTES['yoloswag/swag'].variances.length === 1)
      assert(ROUTES['yoloswag/swag'].variances[0].histogram.getCount() === 2)
    })

    it('should merge as a new variance with the same route', function () {
      let trace2 = TraceFactory.generateTrace('yoloswag/swag', 3)
      trace2.spans.forEach(function (span) {
        span.min = span.max = span.mean = Math.round(new Date(span.endTime) - new Date(span.startTime))
      })
      aggregator.mergeTrace(ROUTES['yoloswag/swag'], trace2)
      assert(ROUTES['yoloswag/swag'].meta.histogram.getCount() === 3)
      assert(ROUTES['yoloswag/swag'].variances.length === 2)
      assert(ROUTES['yoloswag/swag'].variances[0].histogram.getCount() === 2)
      assert(ROUTES['yoloswag/swag'].variances[1].histogram.getCount() === 1)
      assert(ROUTES['yoloswag/swag'].variances[1].spans.length === 4)
    })
  })

  describe('.aggregate', function () {
    it('should not fail', function () {
      let dt = aggregator.aggregate(null)
      assert(dt === false)
    })

    it('should aggregate', function () {
      // Simulate some data
      let packet = TraceFactory.generatePacket('yoloswag/swag', 'appname')
      aggregator.aggregate(packet)
      packet = TraceFactory.generatePacket('yoloswag/swag', 'appname')
      aggregator.aggregate(packet)
      packet = TraceFactory.generatePacket('yoloswag/swag', 'appname')
      aggregator.aggregate(packet)
      packet = TraceFactory.generatePacket('sisi/aight', 'appname')
      aggregator.aggregate(packet)
      packet = TraceFactory.generatePacket('sisi/aight', 'APP2')
      aggregator.aggregate(packet)

      let agg = aggregator.getAggregation()

      // should get 2 apps in agg
      assert(agg['appname'] !== undefined)
      assert(agg['APP2'] !== undefined)

      // should contain 2 routes for appname
      assert(Object.keys(agg['appname'].routes).length === 2)
      assert(agg['appname'].process !== undefined)
      assert(agg['appname'].meta.trace_count === 4)
      assert(agg['appname'].meta.histogram.percentiles([0.5])[0.5] !== undefined)

      // should pm_id not taken into account
      assert(agg['appname'].process.pm_id === undefined)
    })
  })

  describe('.normalizeAggregation', function () {
    it('should get normalized aggregattion', function (done) {
      let ret = aggregator.prepareAggregationforShipping()
      assert(ret['appname'].process.server !== undefined)
      assert(ret['APP2'].process.server !== undefined)
      done()
    })
  })

  describe('.resetAggregation and .clearData', function () {
    it('should get transactions', function () {
      let cache = aggregator.getAggregation()
      assert(Object.keys(cache).length === 2)
    })

    it('should .resetAggregation for "appname" app', function () {
      let cache = aggregator.getAggregation()

      assert(cache['appname'].meta.trace_count === 4)
      assert(Object.keys(cache['appname'].routes).length === 2)

      aggregator.resetAggregation('appname', {})
      cache = aggregator.getAggregation()
      assert(Object.keys(cache).length === 2)

      assert(cache['appname'].meta.trace_count === 0)
      assert(Object.keys(cache['appname'].routes).length === 0)
    })

    it('should .clearData', function () {
      let cache = aggregator.getAggregation()
      assert(cache['APP2'].meta.trace_count === 1)
      assert(Object.keys(cache['APP2'].routes).length === 1)
      aggregator.clearData()

      cache = aggregator.getAggregation()
      assert(cache['APP2'].meta.trace_count === 0)
      assert(Object.keys(cache['APP2'].routes).length === 0)
    })
  })
  after((done) => {
    clearInterval(aggregator._worker)
    done()
  })
})
