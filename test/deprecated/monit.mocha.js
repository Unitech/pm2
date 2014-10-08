var p = require('path')
  , root = p.resolve(__dirname, '../../')
  , fixtures = p.join(root, 'test/fixtures/')
  // , spawn = require('child_process').spawn
  , Spawner = require('promise-spawner')
  , async = require('async')

  , bin = p.join(root, '/bin/pm2')
  , pm2 = require(p.join(root, 'index.js'))
  , ids = []

var timeout = function(cb, time) {
  return function() {
    setTimeout(cb, time || 2000)
  }
}

describe('Monitor', function() {

  before(function(cb) {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        cb()
      })
    })
  })


  after(function(cb) {
    pm2.killDaemon(function() {
    pm2.disconnect(function() {
      cb()
    })
    });
  })


  it('should start', function() {

    var modifiers = {
        out: function(d) { return d },
        err: 'error: '
    }

    var spawner = new Spawner(modifiers)

    //spawner gives you global streams from spawned stdout and stderr
    spawner.out.pipe(process.stdout)
    spawner.err.pipe(process.stdout)

    spawner
      .spawn(bin + ' monit')
      .catch(function(code) {
        console.log('Script failed with code ', code)
        process.exit(code)
      })
      .then(function(code) {
        if(this.data.err) {
          console.log(this.data.err)
        }

        process.exit(code)
      })

  })

  it('should start monitoring', function(cb) {

    var paths = [p.join(fixtures, 'quit.js'), p.join(fixtures, 'killtoofast.js'), p.join(fixtures, 'server.js'), p.join(fixtures, 'echo.js')]

    async.eachSeries(paths, function(item, next) {

      pm2.start(item, {}, function(err, data) {
        if(err)
          throw err

        ids.push(data[0].pm2_env.pm_id);

        setTimeout(function() {
          next();
        }, 2000)
      })

    }, cb)

  })

  it('should delete', function(cb) {
    pm2.delete(ids[3], timeout(cb))
  })

  it('should stop', function(cb) {
    pm2.stop(ids[2], timeout(cb))
  })

  it('should restart', function(cb) {
    pm2.restart(ids[1], timeout(cb))
  })

  after(function() {
    pm2.connect(function() {
      pm2.delete('all', function(err, ret) {
        process.exit(0)
      })
    })
  })
})
