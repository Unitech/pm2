var should = require('should');
var p = require('path');
var fs = require('fs')
var EventEmitter = require('events').EventEmitter
var PM2  = require('../..');
var extend = require('util')._extend

var cwd = __dirname + '/../fixtures/watcher';

var paths = {
  server : p.join(cwd, 'server-watch.js'),
  bak    : p.join(cwd, 'server-watch.bak.js'),
  json   : p.join(cwd, 'server-watch.json')
};

var ee = new EventEmitter()

var json = {
  name  : 'server-watch',
  script: './server-watch.js',
  cwd   : cwd
}

function testPM2Env(event) {
  return function(obj, cb) {
    ee.once(event, function(e) {
      if(typeof obj == 'function') {
        return obj(e)
      }

      var value

      for(var key in obj) {
        value = obj[key]
        console.log('Testing %s for value %s', key, value)
        should(e[key]).eql(value)
      }

      return cb()
    })
  }
}

function errShouldBeNull(err) {
  should(err).be.null();
}

describe('Watcher', function() {
  var pm2 = new PM2.custom({
    cwd : __dirname + '/../fixtures/watcher'
  });

  after(function(cb) {
    pm2.destroy(function() {
      fs.unlink(paths.server, cb)
    });
  });

  before(function(cb) {
    //copy server-watch.bak, we'll add some lines in it
    fs.readFile(paths.bak, function(err, data) {
      if(err) {
        return cb(err)
      }

      return fs.writeFile(paths.server, data, cb)
    })
  })

  before(function(done) {
    pm2.connect(function() {
      done();
    });
  });

  before(function(done) {
    pm2.launchBus(function(err, bus) {
      should(err).be.null

      bus.on('process:event', function(e) {
        var name = e.process.name + ':' + e.event
        console.log('Bus receiving: ' + name)
        delete e.process.ENV
        ee.emit(name, e.process)
      })

      return done()
    })
  })

  it('should be watching', function(cb) {
    testPM2Env('server-watch:online')({watch: true}, cb)

    var json_app = extend(json, {watch: true});
    pm2.start(json_app, errShouldBeNull)
  })

  it('should be watching after restart', function(cb) {
    testPM2Env('server-watch:online')({watch: true}, cb)
    pm2.restart('server-watch', errShouldBeNull)
  })

  it('should restart because of file edit', function(cb) {
    testPM2Env('server-watch:online')({restart_time: 2}, cb)
    fs.appendFileSync(paths.server, 'console.log("edit")')
  })

  it('should stop watching', function(cb) {
    process.argv.push('--watch')
    testPM2Env('server-watch:stop')({watch: false}, function() {
      process.argv.splice(process.argv.indexOf('--watch'), 1)
      cb()
    })
    pm2.stop('server-watch', errShouldBeNull)

    // this would be better:
    // pm2.actionFromJson('stopProcessId', extend(json, {watch: false}), errShouldBeNull)
    // or :
    // pm2.stop('server-watch', {watch: false}, errShouldBeNull)
  })

  it('should not watch', function(cb) {
    testPM2Env('server-watch:online')({watch: false}, cb)
    pm2.restart(extend(json, {watch: false}), errShouldBeNull)
  })

  it('should watch', function(cb) {
    testPM2Env('server-watch:online')({restart_time: 3, watch: true}, cb)
    pm2.restart(extend(json, {watch: true}), errShouldBeNull)
  })

  it('should delete process', function(cb) {
    pm2.delete('server-watch', cb)
  })

  it('should watch json', function(cb) {
    testPM2Env('server-watch:online')(function() {
      cb()
    })

    var json_app = paths.json;
    pm2.start(json_app, errShouldBeNull)
  })

  it('should restart json from file touch', function(cb) {
    testPM2Env('server-watch:online')({restart_time: 1}, cb)

    var path = p.join(cwd, 'donotwatchme.dir', 'test')

    fs.writeFile(path, 'Test', {flag: 'a+'}, function(err) {
      errShouldBeNull(err)
    })
  })

  it('should restart json from file deletion', function(cb) {
    testPM2Env('server-watch:online')({restart_time: 2}, cb)

    var path = p.join(cwd, 'donotwatchme.dir', 'test')

    fs.unlink(path, function(err) {
      errShouldBeNull(err)
    })
  })

  it('should not restart from ignore_watch', function(cb) {

    var path = p.join(cwd, 'pm2.log')

    fs.writeFile(path, 'Log', {flag: 'a+'}, function(err) {
      errShouldBeNull(err)

      pm2.describe('server-watch', function(err, d) {
        should(d[0].pm2_env.restart_time).eql(2)
        fs.unlinkSync(path)
        return cb()
      })
    })
  })

  it('should work with watch_delay', function(cb) {
    testPM2Env('server-watch:online')({watch: true, watch_delay: 4000}, cb);
    pm2.start(extend(json, {watch: true, watch_delay: 4000}), errShouldBeNull);
  })

  it('should not crash with watch_delay without watch', function(cb) {
    testPM2Env('server-watch:online')({watch_delay: 4000}, cb);
    pm2.start(extend(json, {watch_delay: 4000}), errShouldBeNull);
  })

  /**
   * Test #1668
   */
  it('should delete from json', function(cb) {
    testPM2Env('server-watch:exit')(function() {
      cb()
    })

    pm2.delete(paths.json, errShouldBeNull)
  })
})
