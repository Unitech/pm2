
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
