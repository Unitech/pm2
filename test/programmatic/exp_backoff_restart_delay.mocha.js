
process.env.EXP_BACKOFF_RESET_TIMER = 500
process.env.PM2_WORKER_INTERVAL = 100

const PM2 = require('../..');
const should = require('should');
const exec = require('child_process').exec
const path = require('path')

describe('Exponential backoff feature', function() {
  var pm2
  var test_path = path.join(__dirname, 'fixtures', 'exp-backoff')

  after(function(done) {
    pm2.delete('all', function() {
      pm2.kill(done);
    })
  });

  before(function(done) {
    pm2 = new PM2.custom({
      cwd : test_path
    });

    pm2.delete('all', () => done())
  })

  it('should set exponential backoff restart', (done) => {
    pm2.start({
      script: path.join(test_path, 'throw-stable.js'),
      exp_backoff_restart_delay: 100
    }, (err, apps) => {
      should(err).be.null()
      should(apps[0].pm2_env.exp_backoff_restart_delay).eql(100)
      done()
    })
  })

  it('should have set the prev_restart delay', (done) => {
    setTimeout(() => {
      pm2.list((err, procs) => {
        should(procs[0].pm2_env.prev_restart_delay).be.aboveOrEqual(100)
        done()
      })
    }, 800)
  })

  it('should have incremented the prev_restart delay', (done) => {
    setTimeout(() => {
      pm2.list((err, procs) => {
        should(procs[0].pm2_env.prev_restart_delay).be.above(100)
        done()
      })
    }, 500)
  })

  it('should reset prev_restart_delay if application has reach stable uptime', (done) => {
    setTimeout(() => {
      pm2.list((err, procs) => {
        should(procs[0].pm2_env.prev_restart_delay).be.eql(0)
        done()
      })
    }, 3000)
  })
})
