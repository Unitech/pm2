
const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe('ProfilingAction', function () {
  this.timeout(50000)

  describe('CPU', () => {

    it('should get cpu profile data', (done) => {
      const child = launch('../fixtures/features/profilingChild')
      let uuid

      child.on('message', (res) => {
        if (typeof res === 'string') {
          if (res === 'initialized') {
            child.send('km:cpu:profiling:start')

            setTimeout(function () {
              child.send('km:cpu:profiling:stop')
            }, 500)
          }
          return
        }

        if (res.type === 'axm:action') {
          assert.strictEqual(res.data.action_type, 'internal')
        }

        if (res.type === 'axm:reply') {
          assert.strictEqual(res.data.return.success, true)
          if (res.data.action_name === 'km:cpu:profiling:start') {
            uuid = res.data.return.uuid
          }
        }
        if (res.type === 'profilings') {
          assert.strictEqual(typeof res.data.data, 'string')

          assert.strictEqual(res.data.type, 'cpuprofile')

          child.kill('SIGINT')
          done()
        }
      })
    })

    it('should get cpu profile data with timeout', (done) => {
      const child = launch('../fixtures/features/profilingChild')
      let uuid

      child.on('message', (res) => {
        if (typeof res === 'string') {
          if (res === 'initialized') {
            child.send({
              msg: 'km:cpu:profiling:start',
              opts: { timeout: 500 }
            })
          }
          return
        }

        if (res.type === 'axm:action') {
          assert.strictEqual(res.data.action_type, 'internal')
        }

        if (res.type === 'axm:reply') {
          if (res.data.action_name === 'km:cpu:profiling:start') {
            assert.strictEqual(res.data.return.success, true)
            uuid = res.data.return.uuid
          }
        }
        if (res.type === 'profilings') {
          assert.strictEqual(typeof res.data.data, 'string')

          assert.strictEqual(res.data.type, 'cpuprofile')

          child.kill('SIGINT')
          done()
        }
      })
    })
  })

  describe('Heap', () => {
    it('should get heap profile data', (done) => {
      const child = launch('../fixtures/features/profilingChild')
      let uuid

      child.on('message', (res) => {
        if (typeof res === 'string') {
          if (res === 'initialized') {
            setTimeout(function () {
              child.send('km:heap:sampling:start')
            }, 100)

            setTimeout(function () {
              child.send('km:heap:sampling:stop')
            }, 500)
          }
          return
        }

        if (res.type === 'axm:action') {
          assert.strictEqual(res.data.action_type, 'internal')
        }

        if (res.type === 'axm:reply') {
          assert.strictEqual(res.data.return.success, true)
          if (res.data.action_name === 'km:heap:sampling:start') {
            uuid = res.data.return.uuid
          }
        }
        if (res.type === 'profilings') {
          assert.strictEqual(typeof res.data.data, 'string')

          assert.strictEqual(res.data.type, 'heapprofile')
          child.kill('SIGINT')
        }
      })

      child.on('exit', function () {
        done()
      })
    })

    it('should get heap profile data with timeout', (done) => {
      const child = launch('../fixtures/features/profilingChild')
      let uuid

      child.on('message', (res) => {
        if (typeof res === 'string') {
          if (res === 'initialized') {
            setTimeout(function () {
              child.send({
                msg: 'km:heap:sampling:start',
                opts: { timeout: 500 }
              })
            }, 100)
          }
          return
        }

        if (res.type === 'axm:action') {
          assert.strictEqual(res.data.action_type, 'internal')
        }

        if (res.type === 'axm:reply') {
          assert.strictEqual(res.data.return.success, true)

          if (res.data.action_name === 'km:heap:sampling:start') {
            uuid = res.data.return.uuid
          }
        }
        if (res.type === 'profilings') {
          assert.strictEqual(typeof res.data.data, 'string')

          assert.strictEqual(res.data.type, 'heapprofile')
          child.kill('SIGINT')
        }
      })

      child.on('exit', function () {
        done()
      })
    })
  })
})
