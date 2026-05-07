
const assert = require('assert')
const { resolve } = require('path')

const { exec, fork } = require('child_process')
const pmx = require('..')
const { MetricType } = require('../services/metrics')


const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe('API', function () {
  this.timeout(10000)

  describe('Notify', () => {
    it('should receive data from notify', (done) => {
      const child = launch('fixtures/apiNotifyChild.js')

      child.on('message', (msg) => {
        if (msg.data?.message === 'myNotify') {
          assert.strictEqual(msg.data.message, 'myNotify')
          child.kill('SIGINT')
          done()
        }
      })
    })
  })

  describe('Metrics', () => {
    it('should receive data from metric', (done) => {
      const child = launch('fixtures/apiMetricsChild.js')

      child.on('message', (res) => {
        if (res.type === 'axm:monitor') {
          // both metrics aren't used
          assert.strictEqual(res.data.hasOwnProperty('metric with spaces'), false)
          assert.strictEqual(res.data.hasOwnProperty('metric wi!th special chars % ///'), false)
          assert.strictEqual(res.data.hasOwnProperty('metricHistogram'), true)
          assert.strictEqual(res.data.hasOwnProperty('metricInline'), true)
          assert.strictEqual(res.data.hasOwnProperty('toto'), true)
          assert.strictEqual(res.data.metricHistogram.value, 10)
          assert.strictEqual(res.data.metricHistogram.type, 'metric/custom')
          assert.strictEqual(res.data.metricInline.value, 11)
          assert.strictEqual(res.data.toto.value, 42)

          child.kill('SIGINT')
          return done()
        }
      })

      child.on('error', done)
    })
  })

  describe('Actions', () => {
    it('should receive data from action', (done) => {
      const child = launch('fixtures/apiActionsChild')

      child.on('message', (res) => {
        if (res.type === 'axm:action' && res.data.action_name === 'testAction') {
          child.send(res.data.action_name)
        } else if (res.type === 'axm:reply') {
          assert.strictEqual(res.data.action_name, 'testAction')
          assert.strictEqual(res.data.return.data, 'testActionReply')
          child.kill('SIGINT')
          done()
        }
      })
    })

    it('should receive data from action with conf', (done) => {
      const child = launch('fixtures/apiActionsJsonChild')

      child.on('message', (res) => {
        if (res.type === 'axm:action' && res.data.action_name === 'testActionWithConf') {
          child.send(res.data.action_name)
        } else if (res.type === 'axm:reply') {
          assert.strictEqual(res.data.action_name, 'testActionWithConf')
          assert.strictEqual(res.data.return.data, 'testActionWithConfReply')
          child.kill('SIGINT')
          done()
        }
      })
    })
  })

  describe('Histogram', () => {
    it('should return an histogram', () => {
      const firstWay = pmx.histogram('firstWay')
      const secondWay = pmx.histogram({
        name: 'secondWay'
      })

      assert.strictEqual(firstWay.constructor.name, 'Histogram')
      assert.strictEqual(secondWay.constructor.name, 'Histogram')
    })
  })

  describe('Counter', () => {
    it('should return a counter', () => {
      const firstWay = pmx.counter('firstWay')
      const secondWay = pmx.counter({
        name: 'secondWay'
      })

      assert.strictEqual(firstWay.constructor.name, 'Counter')
      assert.strictEqual(secondWay.constructor.name, 'Counter')
    })
  })

  describe('Meter', () => {
    it('should return a counter', () => {
      const firstWay = pmx.meter('firstWay')
      const secondWay = pmx.meter({
        name: 'secondWay'
      })

      assert.strictEqual(firstWay.constructor.name, 'Meter')
      assert.strictEqual(secondWay.constructor.name, 'Meter')
    })
  })

  describe('Metric', () => {
    it('should return an metric', () => {
      const firstWay = pmx.metric('firstWay')
      const secondWay = pmx.metric({
        name: 'secondWay'
      })

      assert.strictEqual(typeof firstWay.val === 'function', true)
      assert.strictEqual(typeof secondWay.val === 'function', true)
    })
  })

  describe('onExit', () => {
    it.skip('should catch signals and launch callback', (done) => {
      const child = launch('fixtures/apiOnExitChild')

      child.on('message', res => {
        if (res === 'callback') {
          done()
        }
      })

      setTimeout(function () {
        child.kill('SIGINT')
      }, 1000)

    })

    it('should return null cause no callback provided', () => {
      const fn = pmx.onExit()
      assert.strictEqual(fn, undefined)
    })

    it.skip('should catch uncaught exception and launch callback', (done) => {
      const child = launch('fixtures/apiOnExitExceptionChild')
      var callbackReceived = false

      child.on('message', (res) => {
        if (typeof res === 'object' && res.type === 'process:exception') {
          assert(!!res.data.message.match(/Cannot read property/))
        }
        if (res === 'callback' && !callbackReceived) {
          callbackReceived = true
          done()
        }
      })
    })
  })

  describe('Compatibility', () => {

    it('should return metrics object with clean keys', () => {
      const metrics = pmx.metrics([
        {
          name: 'metricHistogram',
          type: MetricType.histogram,
          id: 'metric/custom'
        },
        {
          name: 'metric with spaces',
          type: MetricType.histogram,
          id: 'metric/custom'
        },
        {
          name: 'metric wi!th special chars % ///',
          type: MetricType.histogram,
          id: 'metric/custom'
        },
        {
          name: 'metricFailure',
          type: 'notExist'
        }
      ])
      assert.strictEqual(metrics[0].constructor.name === 'Histogram', true)
      assert.strictEqual(metrics[1].constructor.name === 'Histogram', true)
      assert.strictEqual(metrics[2].constructor.name === 'Histogram', true)
      assert.strictEqual(metrics[3].constructor.name === 'Object', true)
      assert.strictEqual(Object.keys(metrics).length, 4)
    })

    it('should receive data from event', (done) => {
      const child = launch('fixtures/apiBackwardEventChild')

      child.on('message', (res) => {
        if (res.type === 'human:event') {
          assert.strictEqual(res.data.__name, 'myEvent')
          assert.strictEqual(res.data.prop1, 'value1')

          child.kill('SIGINT')
          done()
        }
      })
    })

    it('should receive data from expressErrorHandler', (done) => {
      const child = launch('fixtures/apiBackwardExpressChild')

      child.on('message', (msg) => {
        if (msg === 'expressReady') {
          const httpModule = require('http')
          httpModule.get('http://localhost:3003/error')
        } else if (typeof msg === 'object' && msg.type === 'process:exception') {
          assert.strictEqual(msg.data.message, 'toto')
          assert.strictEqual(msg.data.metadata.http.path, '/error')
          assert.strictEqual(msg.data.metadata.http.method, 'GET')
          assert.strictEqual(msg.data.metadata.http.route, '/error')
          child.kill('SIGINT')
          done()
        }
      })
    })

    it.skip('should receive data from koaErrorHandler (requires koa)', () => {})

    it.skip('should not make errors swallowed when koaErrorHandler is used (requires koa)', () => {})

    it.skip('should enable tracing + metrics', (done) => {
      const child = launch('fixtures/apiBackwardConfChild')
      let tracingDone = false
      let metricsDone = false
      let finished = false

      child.on('message', (packet) => {

        if (packet.type === 'trace-span') {
          assert.strictEqual(packet.data.hasOwnProperty('id'), true)
          assert.strictEqual(packet.data.hasOwnProperty('traceId'), true)
          tracingDone = true
        }

        if (packet.type === 'axm:monitor') {
          assert(packet.data['Heap Usage'] !== undefined)
          if (packet.data['HTTP'] !== undefined) {
            assert(packet.data['HTTP Mean Latency'] !== undefined)
            assert(packet.data['HTTP P95 Latency'] !== undefined)
            metricsDone = true
          }
        }

        if (tracingDone && metricsDone && !finished) {
          finished = true
          child.kill('SIGINT')
          done()
        }
      })
    })
  })

  describe('InitModule', () => {
    it('should return module conf', () => {
      process.env.mocha = JSON.stringify({
        test: 'processTest',
        bool: true,
        boolAsString: 'true',
        number: '12',
        object: {
          prop1: 'value1'
        }
      })

      const conf = pmx.initModule({
        test2: 'toto'
      })

      assert.strictEqual(conf.test2, 'toto')
      assert.strictEqual(conf.module_conf.test, 'processTest')
      assert.strictEqual(conf.module_conf.bool, true)
      assert.strictEqual(conf.module_conf.boolAsString, true)
      assert.strictEqual(typeof conf.module_conf.number, 'number')
      assert.strictEqual(conf.module_conf.number, 12)
      assert.strictEqual(typeof conf.module_conf.object, 'object')
      assert.strictEqual(conf.module_conf.object.prop1, 'value1')

      assert.strictEqual(conf.module_name, 'mocha')
      assert.strictEqual(typeof conf.module_version, 'string')
      assert.strictEqual(typeof conf.module_name, 'string')
      assert.strictEqual(typeof conf.description, 'string')
      assert.strictEqual(conf.apm.type, 'node')
      assert.strictEqual(typeof conf.apm.version, 'string')
    })

    it('should return module conf with callback', () => {
      process.env.mocha = JSON.stringify(new Date())

      pmx.initModule({
        test2: 'toto'
      }, (err, conf) => {
        assert.strictEqual(typeof conf.module_conf, 'object')
        assert.strictEqual(typeof conf.module_version, 'string')
        assert.strictEqual(typeof conf.module_name, 'string')
        assert.strictEqual(typeof conf.description, 'string')
        assert.strictEqual(conf.apm.type, 'node')
        assert.strictEqual(typeof conf.apm.version, 'string')
        assert.strictEqual(conf.test2, 'toto')
        assert.strictEqual(conf.module_name, 'mocha')
        assert.strictEqual(err, null)
      })
    })

    it('should return minimal conf', () => {
      const conf = pmx.initModule()
      assert.strictEqual(conf.module_name, 'mocha')
      assert.strictEqual(typeof conf.module_version, 'string')
      assert.strictEqual(typeof conf.module_name, 'string')
      assert.strictEqual(typeof conf.description, 'string')
      assert.strictEqual(conf.apm.type, 'node')
      assert.strictEqual(typeof conf.apm.version, 'string')
    })

    it('should receive data from init module', (done) => {
      const child = launch('fixtures/apiInitModuleChild')

      child.on('message', (pck) => {
        if (pck.type === 'axm:option:configuration' && pck.data.module_name === 'fixtures') {
          const conf = pck.data
          assert.strictEqual(conf.module_version, '0.0.1')
          assert.strictEqual(typeof conf.module_name, 'string')
          assert.strictEqual(conf.apm.type, 'node')
          assert.strictEqual(typeof conf.apm.version, 'string')
          child.kill('SIGINT')
          done()
        }
      })
    })
  })

  describe('Multiple instantiation', () => {
    it('should retrieve config of the previous instantiation', () => {

      pmx.init({ metrics: { v8: true } })
      let conf = pmx.getConfig()
      assert.strictEqual(conf.metrics.v8, true)
      assert.strictEqual(conf.metrics.http, undefined)

      pmx.init({ metrics: { http: false } })
      conf = pmx.getConfig()

      assert.strictEqual(conf.metrics.v8, undefined)
      assert.strictEqual(conf.metrics.http, false)

      pmx.destroy()
    })
  })
})
