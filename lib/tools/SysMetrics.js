/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

/**
 * SysMetrics — minimal, dependency-free host metrics collector.
 *
 * Replaces the `systeminformation` / `pm2-sysmonit` pair for the metrics
 * `pm2 ls` displays. Linux & macOS only (other platforms get the os-module
 * subset). Design constraints:
 *
 *  - No shell: `os`/`fs` for everything possible, `execFile` (never `exec`,
 *    never `/bin/sh`) with a hard timeout for the few macOS-only items.
 *    This structurally removes the entire `systeminformation` command
 *    injection (CWE-78) class.
 *  - Interface names come from `os.networkInterfaces()` and are validated
 *    against a strict whitelist before being passed as an argv (never a
 *    shell string).
 *  - Every collector is isolated: a failure yields a missing key, never a
 *    throw — the daemon must not crash on a parse error.
 *
 * Testability: `create()` returns an isolated collector instance with its
 * own delta state, exposing both `collect()` and each sub-collector
 * (`cpuUsage`, `ram`, `net`, `diskIO`, `fsUsage`). Tests exercise the real
 * `os`/`fs`/`execFile` calls — no mocking — and assert shape + sane ranges.
 * `module.exports` is a ready singleton (used by the daemon Worker);
 * `module.exports.create` builds a fresh one for tests.
 *
 * `collect()` returns a Promise resolving to an object shaped like a pmx
 * `axm_monitor` map (`{ '<Name>': { value, unit } }`) and also invokes an
 * optional callback, so the existing `pm2 ls` renderer consumes it
 * unchanged.
 */

const os = require('os')
const fs = require('fs')
const { execFile } = require('child_process')

const PLATFORM = process.platform
const IS_LINUX = PLATFORM === 'linux'
const IS_DARWIN = PLATFORM === 'darwin'

// Only ever passed as an argv element, never interpolated into a shell.
const IFACE_RE = /^[A-Za-z0-9._-]+$/

const EXEC_OPTS = { timeout: 2000, maxBuffer: 1024 * 1024, windowsHide: true }

function execFileP (bin, args) {
  return new Promise((resolve) => {
    try {
      execFile(bin, args, EXEC_OPTS, (err, stdout) => resolve(err ? null : stdout.toString()))
    } catch (e) {
      resolve(null)
    }
  })
}

function metric (value, unit) {
  return { value: value, type: 'metric', unit: unit, historic: true }
}

/**
 * Build an isolated collector with its own previous-sample state.
 * @returns {{collect:Function, cpuUsage:Function, ram:Function, net:Function, diskIO:Function, fsUsage:Function, state:Function}}
 */
function create () {
  // Previous sample, for rate/percent deltas between collect() calls.
  var prev = { ts: 0, cpu: null, net: {}, disk: null }

  /**
   * Aggregate CPU busy % between two os.cpus() snapshots.
   */
  function cpuUsage () {
    var cpus = os.cpus() || []
    var idle = 0
    var total = 0
    cpus.forEach(function (c) {
      var t = c.times
      idle += t.idle
      total += t.user + t.nice + t.sys + t.idle + t.irq
    })

    var pct = 0
    if (prev.cpu) {
      var dIdle = idle - prev.cpu.idle
      var dTotal = total - prev.cpu.total
      pct = dTotal > 0 ? (1 - dIdle / dTotal) * 100 : 0
    }
    prev.cpu = { idle: idle, total: total }
    return Math.max(0, Math.min(100, pct))
  }

  /**
   * RAM. Returns { total, available, active } in bytes + usagePct.
   */
  async function ram () {
    var total = os.totalmem()
    var free = os.freemem()
    var active = total - free
    var available = free

    if (IS_LINUX) {
      try {
        var mi = fs.readFileSync('/proc/meminfo', 'utf8')
        var get = function (k) {
          var m = mi.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm'))
          return m ? parseInt(m[1], 10) * 1024 : null
        }
        var memAvail = get('MemAvailable')
        if (memAvail != null) {
          available = memAvail
          active = total - memAvail
        }
      } catch (e) { /* fall back to os values */ }
    } else if (IS_DARWIN) {
      var ps = await execFileP('sysctl', ['-n', 'vm.pagesize'])
      var pageSize = parseInt((ps || '').trim(), 10) || 4096
      var vm = await execFileP('vm_stat', [])
      if (vm) {
        var ma = vm.match(/Pages active:\s+(\d+)/)
        var mi2 = vm.match(/Pages inactive:\s+(\d+)/)
        if (ma) active = parseInt(ma[1], 10) * pageSize
        var inactive = mi2 ? parseInt(mi2[1], 10) * pageSize : 0
        available = (total - active) + inactive
      }
    }

    var usagePct = total > 0 ? (active / total) * 100 : 0
    return { total: total, available: available, active: active, usagePct: usagePct }
  }

  /**
   * Per-interface cumulative counters: { rx, tx, rxErr, txErr, rxDrop, txDrop }.
   */
  function readLinuxNet (name) {
    var base = '/sys/class/net/' + name + '/statistics/'
    try {
      var rd = function (f) { return parseInt(fs.readFileSync(base + f, 'utf8').trim(), 10) || 0 }
      return {
        rx: rd('rx_bytes'), tx: rd('tx_bytes'),
        rxErr: rd('rx_errors'), txErr: rd('tx_errors'),
        rxDrop: rd('rx_dropped'), txDrop: rd('tx_dropped')
      }
    } catch (e) {
      return null
    }
  }

  async function readDarwinNet (name) {
    // netstat -bdnI <iface> : <iface> is argv, validated by IFACE_RE.
    var out = await execFileP('netstat', ['-bdnI', name])
    if (!out) return null
    var lines = out.split('\n')
    if (lines.length < 2 || lines[1].trim() === '') return null
    var s = lines[1].replace(/ +/g, ' ').trim().split(' ')
    var o = s.length > 11 ? 1 : 0
    var n = function (i) { return parseInt(s[o + i], 10) || 0 }
    // Column layout mirrors systeminformation's proven netstat parser.
    return {
      rx: n(5), tx: n(8),
      rxErr: n(4), txErr: n(7),
      rxDrop: n(10), txDrop: n(10)
    }
  }

  async function net () {
    var names = Object.keys(os.networkInterfaces()).filter(function (n) { return IFACE_RE.test(n) })
    var out = {}
    for (var i = 0; i < names.length; i++) {
      var name = names[i]
      var c = IS_LINUX ? readLinuxNet(name) : (IS_DARWIN ? await readDarwinNet(name) : null)
      if (c) out[name] = c
    }
    return out
  }

  /**
   * Total disk throughput cumulative counters: { read, write } in bytes.
   */
  function readLinuxDisk () {
    try {
      var read = 0
      var write = 0
      var devs = fs.readdirSync('/sys/block')
      devs.forEach(function (d) {
        if (/^(loop|ram|dm-|fd)/.test(d)) return
        try {
          var st = fs.readFileSync('/sys/block/' + d + '/stat', 'utf8').trim().replace(/ +/g, ' ').split(' ')
          // Linux block stat: [2]=read sectors, [6]=write sectors, 512B each.
          read += (parseInt(st[2], 10) || 0) * 512
          write += (parseInt(st[6], 10) || 0) * 512
        } catch (e) { /* skip device */ }
      })
      return { read: read, write: write }
    } catch (e) {
      return null
    }
  }

  async function readDarwinDisk () {
    var out = await execFileP('ioreg', ['-c', 'IOBlockStorageDriver', '-k', 'Statistics', '-r', '-w0'])
    if (!out) return null
    var read = 0
    var write = 0
    var re = /"Bytes \((Read|Write)\)"=(\d+)/g
    var m
    while ((m = re.exec(out)) !== null) {
      if (m[1] === 'Read') read += parseInt(m[2], 10)
      else write += parseInt(m[2], 10)
    }
    return { read: read, write: write }
  }

  function diskIO () {
    if (IS_LINUX) return Promise.resolve(readLinuxDisk())
    if (IS_DARWIN) return readDarwinDisk()
    return Promise.resolve(null)
  }

  /**
   * Per-filesystem usage. Returns [{ mount, usePct, sizeGb }].
   */
  async function fsUsage () {
    if (!IS_LINUX && !IS_DARWIN) return []
    var out = await execFileP('df', ['-kP'])
    if (!out) return []
    var lines = out.split('\n')
    var res = []
    for (var i = 1; i < lines.length; i++) {
      var p = lines[i].replace(/ +/g, ' ').trim().split(' ')
      if (p.length < 6) continue
      if (p[0].indexOf('/dev/') !== 0) continue // real devices only
      var sizeKb = parseInt(p[1], 10) || 0
      var usedKb = parseInt(p[2], 10) || 0
      var availKb = parseInt(p[3], 10) || 0
      var mount = p.slice(5).join(' ')
      var denom = usedKb + availKb
      if (denom <= 0) continue
      res.push({
        mount: mount,
        usePct: parseFloat(((usedKb / denom) * 100).toFixed(2)),
        sizeGb: parseFloat((sizeKb / 1024 / 1024).toFixed(2))
      })
    }
    return res
  }

  /**
   * Turn collected samples into the axm_monitor-shaped map, applying
   * deltas against the previous sample. Pure given inputs + `prev`.
   */
  function buildSnapshot (cpu, mem, netCur, disk, fss, now) {
    var dt = prev.ts > 0 ? (now - prev.ts) / 1000 : 0
    var m = {}

    if (cpu !== null && cpu !== undefined) m['CPU Usage'] = metric(parseFloat(cpu.toFixed(1)), '%')
    // Always present so the (historically unguarded) renderer never throws;
    // -1 == unknown.
    m['CPU Temperature'] = metric(-1, '°C')

    if (mem) {
      m['RAM Usage'] = metric(parseFloat(mem.usagePct.toFixed(1)), '%')
      m['RAM Total'] = metric(mem.total, 'b')
      m['RAM Available'] = metric(mem.available, 'b')
      m['RAM Active'] = metric(mem.active, 'b')
    }

    // Network: cumulative counters -> per-second / per-minute rates.
    Object.keys(netCur || {}).forEach(function (name) {
      var c = netCur[name]
      var p = prev.net[name]
      var rxMb = 0, txMb = 0, rxErr = 0, txErr = 0, rxDrop = 0, txDrop = 0
      if (p && dt > 0) {
        rxMb = Math.max(0, (c.rx - p.rx)) / dt / 1024 / 1024
        txMb = Math.max(0, (c.tx - p.tx)) / dt / 1024 / 1024
        rxErr = Math.max(0, (c.rxErr - p.rxErr)) / dt * 60
        txErr = Math.max(0, (c.txErr - p.txErr)) / dt * 60
        rxDrop = Math.max(0, (c.rxDrop - p.rxDrop)) / dt * 60
        txDrop = Math.max(0, (c.txDrop - p.txDrop)) / dt * 60
      }
      m['net:rx_5:' + name] = metric(parseFloat(rxMb.toFixed(3)), 'mb/s')
      m['net:tx_5:' + name] = metric(parseFloat(txMb.toFixed(3)), 'mb/s')
      m['net:rx_errors_60:' + name] = metric(Math.round(rxErr), '/min')
      m['net:tx_errors_60:' + name] = metric(Math.round(txErr), '/min')
      m['net:rx_dropped_60:' + name] = metric(Math.round(rxDrop), '/min')
      m['net:tx_dropped_60:' + name] = metric(Math.round(txDrop), '/min')
    })
    prev.net = netCur || {}

    // Disk I/O: cumulative bytes -> mb/s.
    var dRead = 0, dWrite = 0
    if (disk && prev.disk && dt > 0) {
      dRead = Math.max(0, (disk.read - prev.disk.read)) / dt / 1024 / 1024
      dWrite = Math.max(0, (disk.write - prev.disk.write)) / dt / 1024 / 1024
    }
    m['Disk Reads'] = metric(parseFloat(dRead.toFixed(3)), 'mb/s')
    m['Disk Writes'] = metric(parseFloat(dWrite.toFixed(3)), 'mb/s')
    if (disk) prev.disk = disk

    ;(fss || []).forEach(function (f) {
      m['fs:use:' + f.mount] = metric(f.usePct, '%')
      m['fs:size:' + f.mount] = metric(f.sizeGb, 'gb')
    })

    prev.ts = now
    return m
  }

  /**
   * Collect one snapshot.
   * @param {Function} [cb] optional cb(axm_monitor) — also returned via Promise.
   * @returns {Promise<Object>}
   */
  function collect (cb) {
    return Promise.all([
      Promise.resolve().then(cpuUsage).catch(function () { return null }),
      ram().catch(function () { return null }),
      net().catch(function () { return {} }),
      diskIO().catch(function () { return null }),
      fsUsage().catch(function () { return [] })
    ]).then(function (r) {
      var m = buildSnapshot(r[0], r[1], r[2], r[3], r[4], Date.now())
      if (cb) cb(m)
      return m
    }).catch(function () {
      if (cb) cb({})
      return {}
    })
  }

  return {
    collect: collect,
    cpuUsage: cpuUsage,
    ram: ram,
    net: net,
    diskIO: diskIO,
    fsUsage: fsUsage,
    // Inspect/reset delta state (tests only).
    state: function () { return prev }
  }
}

// Default singleton used by the daemon Worker; `.create()` for isolated tests.
var singleton = create()
singleton.create = create

module.exports = singleton
