
const tx2 = require('tx2')
const SystemInfos = require('./src/SystemInfos.js')
const PM2Infos = require('./src/pm2.js')

class SysMonit {
  constructor() {
    this.sysinfos = new SystemInfos()
    this.report = {}
    this.pass = 0

    this.pm2infos = new PM2Infos()
    this.pm2_report = {}
  }

  start() {
    this.sysinfos.startCollection()
    this.report = this.sysinfos.report()

    this.pm2infos.startCollection()
    this.pm2_report = this.pm2infos.report()

    this.bindActions()

    setInterval(() => {
      if (this.pass++ < 4)
        this.bindMetrics()
      this.report = this.sysinfos.report()
      this.pm2_report = this.pm2infos.report()

      this.processContinuousMetrics()

      if (process.env.VERBOSE) {
        console.log(JSON.stringify(this.report, '', 2))
        console.log(JSON.stringify(this.pm2_report, '', 2))
      }
    }, 1000)
  }

  bindActions() {
    tx2.action('info', (cb) => {
      cb(this.sysinfos.report())
    })
  }

  processContinuousMetrics() {
    let most_used_disk = this.report.storage.filesystems.reduce((p, v) => {
      return (p.use < v.use ? p : v)
    })

    tx2.metric(`Disk Usage`, '%', () => most_used_disk.use)
    tx2.metric(`Disk Size`, 'gb', () => (most_used_disk.size / 1024 / 1024 / 1024).toFixed(2))

    let tx5 = 0, rx5 = 0
    Object.keys(this.report.network).forEach(iface => {
      tx5 += this.report.network[iface].tx_5
      rx5 += this.report.network[iface].rx_5

    })
    tx2.metric(`Total TX`, 'mb/s', () => tx5)
    tx2.metric(`Total RX`, 'mb/s', () => rx5)
  }

  bindMetrics() {
    tx2.metric('PM2 CPU Usage', '%', () => this.pm2_report.pm2.cpu)
    tx2.metric('PM2 Memory Usage', 'mb', () => this.pm2_report.pm2.mem)

    tx2.metric('PM2 Agent CPU Usage', '%', () => this.pm2_report.agent.cpu)
    tx2.metric('PM2 Agent Memory Usage', 'mb', () => this.pm2_report.agent.mem)

    /**
     * From Sysinfo
     */
    tx2.metric('CPU Usage', '%', () => this.report.cpu.load)
    tx2.metric('CPUs Usage', () => this.report.cpu.loads)
    tx2.metric('CPU Temperature', '°C', () => this.report.cpu.temperature)
    tx2.metric('RAM Total', 'gb', () => this.report.mem.total)
    tx2.metric('RAM Free', 'gb', () => this.report.mem.free)
    tx2.metric('RAM Active', 'gb', () => this.report.mem.active)
    tx2.metric('RAM Available', 'gb', () => this.report.mem.available)
    tx2.metric('RAM Usage', '%', () => this.report.mem.usage)
    tx2.metric('FD Opened', () => this.report.fd.opened)
    tx2.metric('Disk Writes', 'mb/s', () => this.report.storage.io.read)
    tx2.metric('Disk Reads', 'mb/s', () => this.report.storage.io.write)


    this.report.storage.filesystems.forEach((fss, i) => {
      if (!fss.fs) return
      tx2.metric(`fs:use:${fss.fs}`, '%', () => this.report.storage.filesystems[i].use)
      tx2.metric(`fs:size:${fss.fs}`, 'gb', () => (this.report.storage.filesystems[i].size / 1024 / 1024 / 1024).toFixed(2))
    })

    Object.keys(this.report.network).forEach(iface => {
      tx2.metric(`net:tx_5:${iface}`, 'mb/s', () => this.report.network[iface].tx_5)
      tx2.metric(`net:rx_5:${iface}`, 'mb/s', () => this.report.network[iface].rx_5)
      tx2.metric(`net:rx_errors_60:${iface}`, '/min', () => this.report.network[iface].rx_errors_60)
      tx2.metric(`net:tx_errors_60:${iface}`, '/min', () => this.report.network[iface].tx_errors_60)
      tx2.metric(`net:rx_dropped_60:${iface}`, '/min', () => this.report.network[iface].rx_dropped_60)
      tx2.metric(`net:tx_dropped_60:${iface}`, '/min', () => this.report.network[iface].tx_dropped_60)
    })

    if (this.report.graphics.memTotal) {
      tx2.metric('graphics:mem:total', 'mb', () => this.report.graphics.memTotal)
      tx2.metric('graphics:mem:used', 'mb', () => this.report.graphics.memUsed)
      tx2.metric('graphics:temp', '°C', () => this.report.graphics.temperature)
    }

    //tx2.transpose('report', () => this.report)
  }
}

if (require.main === module) {
  let sys = new SysMonit()
  sys.start()
}
