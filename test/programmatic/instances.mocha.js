
const pm2 = require('../..');
const should = require('should');
const path = require('path')
const os = require('os')

describe('PM2 instances max bound test', function() {
  var test_path = path.join(__dirname, 'fixtures', 'instances')

  after((done) => {
    pm2.delete('all', () => { done() })
  })

  before((done) => {
    pm2.uninstall('all', () => {
      pm2.delete('all', () => { done() })
    })
  })

  it('should start maximum number of instances in cluster mode', (done) => {
    pm2.start({
      script: path.join(test_path, 'http.js'),
      instances: 'max'
    }, function(err, apps) {
      should(apps.length).eql(os.cpus().length)
      should(apps[0].pm2_env.exec_mode).eql('cluster_mode')
      should(apps[1].pm2_env.exec_mode).eql('cluster_mode')
      done()
    })
  })

  it('should app be in stable mode', (done) => {
    setTimeout(function() {
      pm2.list(function(err, apps) {
        should(apps[0].pm2_env.restart_time).eql(0)
        should(apps[1].pm2_env.restart_time).eql(0)
        done()
      })
    }, 1000)
  })

  it('should delete all', (done) => {
    pm2.delete('all', function() {
      done()
    })
  })

  it('should start maximum number of instances in cluster mode', (done) => {
    pm2.start({
      script: path.join(test_path, 'http.js'),
      instances: 0
    }, function(err, apps) {
      should(apps.length).eql(os.cpus().length)
      should(apps[0].pm2_env.exec_mode).eql('cluster_mode')
      should(apps[1].pm2_env.exec_mode).eql('cluster_mode')
      done()
    })
  })

  it('should delete all', (done) => {
    pm2.delete('all', function() {
      done()
    })
  })

  it('should start 4 instances in cluster mode', (done) => {
    pm2.start({
      script: path.join(test_path, 'http.js'),
      instances: 4
    }, function(err, apps) {
      should(apps.length).eql(4)
      should(apps[0].pm2_env.exec_mode).eql('cluster_mode')
      should(apps[1].pm2_env.exec_mode).eql('cluster_mode')
      done()
    })
  })

  it('should start maximum number of instances in fork mode', (done) => {
    pm2.start({
      script: path.join(test_path, 'echo.js'),
      exec_mode: 'fork',
      instances: 'max'
    }, function(err, apps) {
      should(apps.length).eql(os.cpus().length)
      should(apps[0].pm2_env.exec_mode).eql('fork_mode')
      should(apps[1].pm2_env.exec_mode).eql('fork_mode')
      done()
    })
  })

  it('should app be in stable mode', (done) => {
    setTimeout(function() {
      pm2.list(function(err, apps) {
        should(apps[0].pm2_env.restart_time).eql(0)
        should(apps[1].pm2_env.restart_time).eql(0)
        done()
      })
    }, 1000)
  })

})
