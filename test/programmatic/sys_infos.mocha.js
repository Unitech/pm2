
const Sysinfos = require('../../lib/Sysinfo/SystemInfo.js')

describe('Sysinfos', function() {
  var sysinfo

  after(() => {
    sysinfo.kill()
  })

  it('should start a failing app in fork mode', function(done) {
    sysinfo = new Sysinfos()
    sysinfo.fork()
    done()
  })

  it('should query procs', function(done) {

    setTimeout(() => {
      sysinfo.query((err, data) => {
        console.log(data)
        done()
      })

    }, 500)
  })

})
