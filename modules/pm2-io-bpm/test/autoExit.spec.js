
const { exec } = require('child_process')
const { resolve } = require('path')

const launch = fixture => {
  return exec(`node ${resolve(__dirname, fixture)}`)
}

describe('API', function () {
  this.timeout(20000)

  describe('AutoExit program', () => {
    it('should exit program when it has no more tasks to process', (done) => {
      const child = launch('fixtures/autoExitChild')
      child.on('exit', () => {
        done()
      })
    })
  })
})
