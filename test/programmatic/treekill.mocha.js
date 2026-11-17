
process.chdir(__dirname)

var spawn = require('child_process').spawn
var should = require('should')
var treekill = require('../../lib/TreeKill')

function checkAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return false
  }
}

function getDescendants(rootPid) {
  try {
    var out = require('child_process').execSync('ps -e -o pid=,ppid=').toString()
    var childrenMap = {}
    out.trim().split('\n').forEach(function (line) {
      var parts = line.trim().split(/\s+/)
      var cpid = parseInt(parts[0], 10)
      var ppid = parseInt(parts[1], 10)
      if (!isNaN(cpid) && !isNaN(ppid)) {
        if (!childrenMap[ppid]) childrenMap[ppid] = []
        childrenMap[ppid].push(cpid)
      }
    })
    var result = []
    function walk(pid) {
      ;(childrenMap[pid] || []).forEach(function (c) {
        result.push(c)
        walk(c)
      })
    }
    walk(rootPid)
    return result
  } catch (e) {
    return []
  }
}

describe('TreeKill', function () {
  this.timeout(15000)

  describe('Classic process tree', function () {
    it('should kill parent and all children', function (done) {
      var parent = spawn('bash', ['-c', 'sleep 999 & sleep 999 & wait'], {
        detached: true,
        stdio: 'ignore'
      })

      setTimeout(function () {
        var descendants = getDescendants(parent.pid)
        descendants.length.should.be.above(0, 'should have spawned children')
        var allPids = [parent.pid].concat(descendants)

        treekill(parent.pid, 'SIGTERM', function (err) {
          should(err).not.be.ok()

          setTimeout(function () {
            allPids.forEach(function (p) {
              checkAlive(p).should.eql(false, 'pid ' + p + ' should be dead')
            })
            done()
          }, 500)
        })
      }, 500)
    })

    it('should kill a deep process tree (3 levels)', function (done) {
      var parent = spawn('bash', ['-c',
        'bash -c "bash -c \'sleep 999\' & sleep 999 & wait" & sleep 999 & wait'
      ], { detached: true, stdio: 'ignore' })

      setTimeout(function () {
        var descendants = getDescendants(parent.pid)
        descendants.length.should.be.aboveOrEqual(3, 'should have 3+ descendants')
        var allPids = [parent.pid].concat(descendants)

        treekill(parent.pid, 'SIGTERM', function (err) {
          should(err).not.be.ok()

          setTimeout(function () {
            allPids.forEach(function (p) {
              checkAlive(p).should.eql(false, 'pid ' + p + ' should be dead')
            })
            done()
          }, 500)
        })
      }, 800)
    })
  })

  describe('Resilient processes (trap signals)', function () {
    it('should kill SIGTERM-trapped processes with SIGKILL', function (done) {
      // Parent and a child both trap SIGTERM — only SIGKILL can kill them
      var parent = spawn('bash', ['-c',
        'trap "" TERM; bash -c "trap \\"\\\" TERM; sleep 999" & sleep 999 & wait'
      ], { detached: true, stdio: 'ignore' })

      setTimeout(function () {
        var descendants = getDescendants(parent.pid)
        descendants.length.should.be.above(0)
        var allPids = [parent.pid].concat(descendants)

        // First try SIGTERM — some processes will survive
        treekill(parent.pid, 'SIGTERM', function () {
          setTimeout(function () {
            // At least the parent should survive SIGTERM (it trapped it)
            // Now kill with SIGKILL — uncatchable, must kill everything
            treekill(parent.pid, 'SIGKILL', function (err) {
              should(err).not.be.ok()

              setTimeout(function () {
                allPids.forEach(function (p) {
                  checkAlive(p).should.eql(false,
                    'pid ' + p + ' should be dead after SIGKILL')
                })
                done()
              }, 500)
            })
          }, 500)
        })
      }, 800)
    })

    it('should kill processes that ignore SIGINT', function (done) {
      var parent = spawn('bash', ['-c',
        'trap "" INT; sleep 999 & sleep 999 & wait'
      ], { detached: true, stdio: 'ignore' })

      setTimeout(function () {
        var descendants = getDescendants(parent.pid)
        var allPids = [parent.pid].concat(descendants)

        treekill(parent.pid, 'SIGKILL', function (err) {
          should(err).not.be.ok()

          setTimeout(function () {
            allPids.forEach(function (p) {
              checkAlive(p).should.eql(false,
                'pid ' + p + ' should be dead after SIGKILL')
            })
            done()
          }, 500)
        })
      }, 500)
    })
  })

  describe('Edge cases', function () {
    it('should handle already-dead process', function (done) {
      var child = spawn('sleep', ['0.1'], { detached: true, stdio: 'ignore' })

      setTimeout(function () {
        checkAlive(child.pid).should.eql(false)
        treekill(child.pid, 'SIGTERM', function (err) {
          should(err).not.be.ok()
          done()
        })
      }, 500)
    })

    it('should handle invalid pid', function (done) {
      treekill(NaN, 'SIGTERM', function (err) {
        should(err).be.ok()
        done()
      })
    })

    it('should call back once and kill the root pid when ps is missing (#6171)', function (done) {
      var child = spawn('sleep', ['999'], { detached: true, stdio: 'ignore' })
      var calls = 0

      setTimeout(function () {
        // spawn() resolves the binary synchronously: restore PATH right after
        var path_env = process.env.PATH
        process.env.PATH = '/nonexistent'
        treekill(child.pid, 'SIGKILL', function (err) {
          calls++
          should(err).not.be.ok()
        })
        process.env.PATH = path_env

        setTimeout(function () {
          calls.should.eql(1)
          checkAlive(child.pid).should.eql(false)
          done()
        }, 500)
      }, 200)
    })

    it('should fall back to the root pid when spawn(ps) throws (Bun, no ps)', function (done) {
      var child = spawn('sleep', ['999'], { detached: true, stdio: 'ignore' })
      var cp = require('child_process')
      var realSpawn = cp.spawn
      var calls = 0
      var threw = null

      setTimeout(function () {
        // Fresh copy loaded with the stub in place, whatever it captures
        var modPath = require.resolve('../../lib/TreeKill')
        delete require.cache[modPath]
        cp.spawn = function () {
          throw new Error('Executable not found in $PATH: "ps"')
        }
        try {
          require(modPath)(child.pid, 'SIGKILL', function (err) {
            calls++
            should(err).not.be.ok()
          })
        } catch (e) {
          threw = e
        }
        cp.spawn = realSpawn
        delete require.cache[modPath]

        setTimeout(function () {
          var alive = checkAlive(child.pid)
          if (alive) try { process.kill(child.pid, 'SIGKILL') } catch (e) {}
          should(threw).be.null()
          calls.should.eql(1)
          alive.should.eql(false)
          done()
        }, 300)
      }, 200)
    })

    it('should complete in under 500ms for a normal tree', function (done) {
      var parent = spawn('bash', ['-c', 'sleep 999 & sleep 999 & sleep 999 & wait'], {
        detached: true,
        stdio: 'ignore'
      })

      setTimeout(function () {
        var start = Date.now()
        treekill(parent.pid, 'SIGTERM', function () {
          var elapsed = Date.now() - start
          elapsed.should.be.below(500, 'treekill took ' + elapsed + 'ms')
          done()
        })
      }, 500)
    })
  })
})
