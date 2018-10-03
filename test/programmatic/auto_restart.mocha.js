
const pm2 = require('../..');
const should = require('should');
const path = require('path')

describe('PM2 auto restart on uncaughtexception', function() {
  var test_path = path.join(__dirname, 'fixtures', 'auto-restart')

  after((done) => {
    pm2.delete('all', () => { done() })
  })

  before((done) => {
    pm2.uninstall('all', () => {
      pm2.delete('all', () => { done() })
    })
  })

  it('should start a failing app in fork mode', function(done) {
    pm2.start({
      script: path.join(test_path, 'throw.js'),
    }, (err, apps) => {
      setTimeout(function() {
        pm2.list((err, list) => {
          should(list[0].pm2_env.restart_time).aboveOrEqual(0)
          pm2.delete('throw', () => {
            done()
          })
        })
      }, 200)
    })
  })

  it('should start a failing app in cluster mode', function(done) {
    pm2.start({
      script: path.join(test_path, 'throw.js'),
      instances: 4
    }, (err, apps) => {
      setTimeout(function() {
        pm2.list((err, list) => {
          should(list[0].pm2_env.restart_time).aboveOrEqual(0)
          pm2.delete('throw', () => {
            done()
          })
        })
      }, 200)
    })
  })
})
