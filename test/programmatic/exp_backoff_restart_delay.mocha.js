
process.env.EXP_BACKOFF_RESET_TIMER = 500
process.env.PM2_WORKER_INTERVAL = 100

const PM2 = require('../..');
const should = require('should');
const exec = require('child_process').exec
const path = require('path')

describe('Exponential backoff feature', function() {
  this.timeout(60000);
  var pm2
  var test_path = path.join(__dirname, 'fixtures', 'exp-backoff')

  // The backoff loop runs at its own pace (faster on fast runtimes like bun,
  // slower on CI): poll for the expected state instead of asserting at fixed
  // sleep offsets, otherwise the check can fire after the loop already
  // completed and the reset timer zeroed prev_restart_delay
  function waitForProc(predicate, cb) {
    var iv = setInterval(() => {
      pm2.list((err, procs) => {
        if (err || !procs || !procs[0]) return
        if (predicate(procs[0])) {
          clearInterval(iv)
          cb(procs[0])
        }
      })
    }, 50)
  }

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
    waitForProc((proc) => proc.pm2_env.prev_restart_delay >= 100, () => done())
  })

  it('should have incremented the prev_restart delay', (done) => {
    waitForProc((proc) => proc.pm2_env.prev_restart_delay > 100, () => done())
  })

  it('should reset prev_restart_delay if application has reach stable uptime', (done) => {
    waitForProc((proc) => {
      return proc.pm2_env.status === 'online' &&
        proc.pm2_env.restart_time === 5 &&
        proc.pm2_env.prev_restart_delay === 0
    }, () => done())
  })
})
