/* eslint-env mocha */

'use strict'

process.env.NODE_ENV = 'test'

const Aggregator = require('../../../src/push/TransactionAggregator.js')
const Utility = require('../../../src/Utility.js')
const TraceFactory = require('../../misc/trace_factory.js')
const path = require('path')
const fs = require('fs')
const assert = require('assert')

describe('StackTrace Utility', function () {
  let aggregator
  let stackParser

  it('should instanciate context cache', function () {
    var cache = new Utility.Cache({
      miss: function (key) {
        try {
          var content = fs.readFileSync(path.resolve(key))
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

  describe('.parse', function () {
    it('should parse stacktrace and get context', function (done) {
      let obj = [{
        labels: {
          stacktrace: JSON.stringify(TraceFactory.stacktrace)
        }
      }]

      aggregator.parseStacktrace(obj)
      assert(obj[0].labels['source/file'].indexOf('test/interface/misc/trace_factory.js:10') < 0)
      assert(obj[0].labels['source/context'] === '\nvar randomRoutes = [\n>>\'/api/bucket\',\n  \'/api/bucket/users\',\n  \'/api/bucket/chameau\',')
      done()
    })

    it('should handle malformated stacktraces', function () {
      aggregator.parseStacktrace([{
        labels: {
          stacktrace: JSON.stringify({
            stack_frame: [{
              line_number: 10,
              column_number: 10,
              method_name: '<anonymous function>'
            }, {
              file_name: 'node_modules/express.js',
              column_number: 10,
              method_name: '<anonymous function>'
            }, {
              file_name: path.resolve(__dirname, 'trace_factory.js'),
              line_number: 10,
              column_number: 10,
              method_name: '<anonymous function>'
            }]
          })
        }
      }])
    })

    it('should handle malformated stacktrace v1', function () {
      aggregator.parseStacktrace([{
        labels: {
          stacktrace: JSON.stringify({
            stack_frame: [{
              file_name: 'events.js'
            }, {
              file_name: 'node_modules/express.js'
            }, {
              file_name: path.resolve(__dirname, 'trace_factory.js')
            }]
          })
        }
      }])
    })

    it('should handle malformated stacktrace v2', function () {
      aggregator.parseStacktrace([{
        labels: {
          stacktrace: JSON.stringify({
            stack_frame: [{
              file_name: 'events.js',
              column_number: 10,
              method_name: '<anonymous function>'
            }, {
              file_name: 'node_modules/express.js',
              column_number: 10,
              method_name: '<anonymous function>'
            }, {
              file_name: path.resolve(__dirname, 'trace_factory.js'),
              line_number: 10,
              column_number: 10,
              method_name: '<anonymous function>'
            }]
          })
        }
      }])
    })

    it('should handle malformated stacktrace v3', function () {
      aggregator.parseStacktrace([{
        labels: {}
      }])
    })

    it('should handle malformated stacktrace v4', function () {
      aggregator.parseStacktrace([{
      }])
    })

    it('should handle malformated stacktrace v5', function () {
      aggregator.parseStacktrace([])
    })

    it('should handle malformated stacktrace v5', function () {
      aggregator.parseStacktrace()
    })
  })

  describe('.attachContext', function () {
    it('should extract context from stackframes', function () {
      assert(stackParser.parse({
        stackframes: [
          {
            file_name: '/toto/tmp/lol',
            line_number: 10
          }
        ]
      }) === false)
    })

    it('should extract context from the stack string', function () {
      let error = new Error()
      // stack is lazy so we need to load it
      error.stack = error.stack
      assert(stackParser.parse(error) === false)
    })
  })

  after((done) => {
    clearInterval(aggregator._worker)
    done()
  })
})
