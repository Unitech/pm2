const assert = require('assert')
const { fork } = require('child_process')
const { resolve } = require('path')

const launch = (fixture) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: []
  })
}

describe('Network', function () {
  this.timeout(10000)

  it('should send network data', (done) => {
    const child = launch('../fixtures/metrics/networkChild')

    child.on('message', (pck) => {

      if (pck.type === 'axm:monitor' && pck.data['Network Out']) {
        child.kill('SIGKILL')

        assert.strictEqual(pck.data.hasOwnProperty('Network In'), true)
        assert.strictEqual(pck.data['Network In'].historic, true)

        assert.strictEqual(pck.data.hasOwnProperty('Network Out'), true)
        assert.strictEqual(pck.data['Network Out'].historic, true)

        done()
      }
    })
  })

  it('should only send upload data', (done) => {
    const child = launch('../fixtures/metrics/networkWithoutDownloadChild')

    child.on('message', (pck) => {

      if (pck.type === 'axm:monitor' && pck.data['Network Out'] && pck.data['Network Out'].value !== '0 B/sec') {
        child.kill('SIGKILL')

        assert.strictEqual(pck.data.hasOwnProperty('Network Out'), true)
        assert.strictEqual(pck.data['Network Out'].historic, true)

        assert.strictEqual(pck.data.hasOwnProperty('Open ports'), false)
        done()
      }
    })
  })
})
