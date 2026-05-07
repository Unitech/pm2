const { fork } = require('child_process')
const assert = require('assert')

const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe('EventsFeature', function () {
  this.timeout(5000)
  describe('emit', () => {

    it('should emit an event', (done) => {
      const child = launch('../fixtures/features/eventsChild')
      child.on('message', (res) => {
        if (res.type === 'human:event') {
          child.kill('SIGKILL')
          assert.strictEqual(res.data.__name, 'myEvent')
          assert.strictEqual(res.data.prop1, 'value1')
          done()
        }
      })
    })
  })
})
