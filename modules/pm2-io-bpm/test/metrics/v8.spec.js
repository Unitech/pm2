const assert = require('assert')
const { fork, exec } = require('child_process')
const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe('V8', function () {
  this.timeout(5000)
  it('should send all data with v8 heap info', (done) => {
    const child = launch('../fixtures/metrics/gcv8Child.js')
    let receive = false

    child.on('message', (pck) => {

      if (pck.type === 'axm:monitor' && receive === false) {
        receive = true
        assert.strictEqual(isNaN(pck.data['Heap Size'].value), false)
        assert.strictEqual(isNaN(pck.data['Used Heap Size'].value), false)
        assert.notStrictEqual(pck.data['Heap Usage'].value, undefined)

        child.kill('SIGINT')
        done()
      }
    })
  })
})
