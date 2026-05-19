/**
 * SysMetrics — real-call tests (no mocks).
 *
 * Every assertion runs the actual os/fs/execFile collectors against the
 * host this suite executes on, then checks shape + sane ranges. The only
 * platform branching is "this metric is unavailable here" (e.g. disk I/O
 * off Linux/macOS), never mocked output.
 */

var should = require('should')
var os = require('os')

var SysMetrics = require('../../lib/tools/SysMetrics.js')

var SUPPORTED = process.platform === 'linux' || process.platform === 'darwin'

function isFiniteNum (v) {
  return typeof v === 'number' && isFinite(v)
}

describe('SysMetrics (real calls, no mocks)', function () {
  this.timeout(15000)

  it('default export is a usable collector and exposes create()', function () {
    should(SysMetrics.collect).be.a.Function()
    should(SysMetrics.create).be.a.Function()
    var a = SysMetrics.create()
    should(a.collect).be.a.Function()
    should(a.cpuUsage).be.a.Function()
    should(a.ram).be.a.Function()
    should(a.net).be.a.Function()
    should(a.diskIO).be.a.Function()
    should(a.fsUsage).be.a.Function()
  })

  it('create() instances have independent delta state', function () {
    var a = SysMetrics.create()
    var b = SysMetrics.create()
    should(a.state()).not.equal(b.state())
    a.cpuUsage()
    should(a.state().cpu).be.an.Object()
    should(b.state().cpu).be.exactly(null)
  })

  describe('cpuUsage()', function () {
    it('returns a number within 0..100 (real os.cpus deltas)', function (done) {
      var sm = SysMetrics.create()
      sm.cpuUsage() // prime
      setTimeout(function () {
        var pct = sm.cpuUsage()
        should(isFiniteNum(pct)).be.true()
        should(pct).be.aboveOrEqual(0)
        should(pct).be.belowOrEqual(100)
        done()
      }, 300)
    })
  })

  describe('ram()', function () {
    it('reports sane real memory numbers', async function () {
      var sm = SysMetrics.create()
      var r = await sm.ram()
      should(r).be.an.Object()
      should(isFiniteNum(r.total)).be.true()
      should(r.total).be.above(0)
      should(r.total).be.belowOrEqual(os.totalmem() + 1) // os.totalmem is the source
      should(isFiniteNum(r.available)).be.true()
      should(r.available).be.aboveOrEqual(0)
      should(isFiniteNum(r.usagePct)).be.true()
      should(r.usagePct).be.aboveOrEqual(0)
      should(r.usagePct).be.belowOrEqual(100)
    })
  })

  describe('net()', function () {
    it('returns real per-interface cumulative counters', async function () {
      var sm = SysMetrics.create()
      var n = await sm.net()
      should(n).be.an.Object()
      if (!SUPPORTED) return
      var ifaces = Object.keys(n)
      should(ifaces.length).be.above(0) // at least loopback
      ifaces.forEach(function (name) {
        var c = n[name]
        ;['rx', 'tx', 'rxErr', 'txErr', 'rxDrop', 'txDrop'].forEach(function (k) {
          should(isFiniteNum(c[k])).be.true()
          should(c[k]).be.aboveOrEqual(0)
        })
      })
    })
  })

  describe('diskIO()', function () {
    it('returns {read,write} byte counters (or null off Linux/macOS)', async function () {
      var sm = SysMetrics.create()
      var d = await sm.diskIO()
      if (!SUPPORTED) {
        should(d).be.exactly(null)
        return
      }
      // ioreg/sysfs can legitimately yield null in restricted envs.
      if (d === null) return
      should(isFiniteNum(d.read)).be.true()
      should(isFiniteNum(d.write)).be.true()
      should(d.read).be.aboveOrEqual(0)
      should(d.write).be.aboveOrEqual(0)
    })
  })

  describe('fsUsage()', function () {
    it('returns real filesystem usage entries', async function () {
      var sm = SysMetrics.create()
      var fss = await sm.fsUsage()
      should(fss).be.an.Array()
      if (!SUPPORTED) return
      should(fss.length).be.above(0)
      fss.forEach(function (f) {
        should(f.mount).be.a.String()
        should(f.mount.length).be.above(0)
        should(isFiniteNum(f.usePct)).be.true()
        should(f.usePct).be.aboveOrEqual(0)
        should(f.usePct).be.belowOrEqual(100)
        should(isFiniteNum(f.sizeGb)).be.true()
        should(f.sizeGb).be.aboveOrEqual(0)
      })
    })
  })

  describe('collect()', function () {
    it('resolves to an axm_monitor-shaped snapshot with sane values', async function () {
      var sm = SysMetrics.create()
      var snap = await sm.collect()
      should(snap).be.an.Object()

      ;['CPU Usage', 'CPU Temperature', 'RAM Usage', 'RAM Total',
        'RAM Available', 'Disk Reads', 'Disk Writes'].forEach(function (k) {
        should(snap).have.property(k)
        should(snap[k]).be.an.Object()
        should(snap[k]).have.property('value')
        should(snap[k]).have.property('unit')
        should(isFiniteNum(snap[k].value)).be.true()
      })

      should(snap['CPU Usage'].value).be.within(0, 100)
      should(snap['CPU Usage'].unit).be.exactly('%')
      should(snap['RAM Usage'].value).be.within(0, 100)
      should(snap['RAM Total'].value).be.above(0)
      should(snap['CPU Temperature'].value).be.exactly(-1) // unknown on test hosts

      if (SUPPORTED) {
        var netKeys = Object.keys(snap).filter(function (k) { return k.indexOf('net:rx_5:') === 0 })
        should(netKeys.length).be.above(0)
        netKeys.forEach(function (k) {
          should(isFiniteNum(snap[k].value)).be.true()
          should(snap[k].value).be.aboveOrEqual(0)
        })
      }
    })

    it('invokes the optional callback with the same snapshot', function (done) {
      var sm = SysMetrics.create()
      sm.collect(function (data) {
        should(data).be.an.Object()
        should(data).have.property('RAM Total')
        done()
      })
    })

    it('two sequential collects produce finite, non-negative rates', async function () {
      var sm = SysMetrics.create()
      await sm.collect() // prime delta state
      await new Promise(function (r) { setTimeout(r, 400) })
      var snap = await sm.collect()

      should(snap['Disk Reads'].value).be.aboveOrEqual(0)
      should(snap['Disk Writes'].value).be.aboveOrEqual(0)
      should(isFiniteNum(snap['Disk Reads'].value)).be.true()

      if (SUPPORTED) {
        Object.keys(snap).filter(function (k) {
          return k.indexOf('net:rx_5:') === 0 || k.indexOf('net:tx_5:') === 0
        }).forEach(function (k) {
          should(isFiniteNum(snap[k].value)).be.true()
          should(snap[k].value).be.aboveOrEqual(0)
        })
      }
    })
  })
})
