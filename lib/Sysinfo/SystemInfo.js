
const sysinfo = require('systeminformation')
const psList = require('./psList.js')
const async = require('async')
const MeanCalc = require('./MeanCalc.js')
const fork = require('child_process').fork
const DEFAULT_CONVERSION = 1024 * 1024
const EventEmitter = require('events')
const os = require('os')
const fs = require('fs')

class SystemInfo extends EventEmitter {
  constructor() {
    super()
    this.infos = {
      baseboard: {
        model: null,
        version: null
      },
      cpu: {
        manufacturer: null,
        brand: null,
        speedmax: null,
        cores: null,
        physicalCores: null,
        processors: null,
        temperature: null,
        usage: null
      },
      mem: {
        total: null,
        free: null,
        active: null
      },
      os: {
        platform: null,
        distro: null,
        release: null,
        codename: null,
        kernel: null,
        arch: null,
      },
      fd: {
        opened: null
      },
      storage: {
        io: {
          read: new MeanCalc(15),
          write: new MeanCalc(15)
        },
        physical_disks: [{
          device: null,
          type: null,
          name: null,
          interfaceType: null,
          vendor: null
        }],
        filesystems: [{
        }]
      },
      network: {
        latency: new MeanCalc(5),
        tx_5: new MeanCalc(5),
        rx_5: new MeanCalc(5),
        rx_errors_60: new MeanCalc(60),
        tx_errors_60: new MeanCalc(60),
        tx_dropped_60: new MeanCalc(60),
        rx_dropped_60: new MeanCalc(60)
      },
      // Procs
      containers: [],
      processes: {
        cpu_sorted: null,
        mem_sorted: null
      },
      services: {
        running: null,
        stopped: null
      }
    }
    this.restart = true
  }

  // Cast MeanCalc and other object to real value
  // This method retrieve the machine snapshot well formated
  report() {
    var report = JSON.parse(JSON.stringify(this.infos))
    report.network.latency = this.infos.network.latency.val()
    report.network.tx_5 = this.infos.network.tx_5.val()
    report.network.rx_5 = this.infos.network.rx_5.val()
    report.network.rx_errors_60 = this.infos.network.rx_errors_60.val()
    report.network.tx_errors_60 = this.infos.network.tx_errors_60.val()
    report.network.rx_dropped_60 = this.infos.network.rx_dropped_60.val()
    report.network.tx_dropped_60 = this.infos.network.tx_dropped_60.val()
    report.storage.io.read = this.infos.storage.io.read.val()
    report.storage.io.write = this.infos.storage.io.write.val()
    return report
  }

  fork() {
    this.process = fork(__filename, {
      detached: false,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    })

    this.process.on('exit', () => {
      console.log('process offline')
      if (this.restart == true)
      this.fork()
    })

    this.process.on('error', (e) => {
      console.log(`Sysinfo errored`, e)
    })

    this.process.on('message', (data) => {
      var report = null

      try {
        report = JSON.parse(data)
      }
      catch (e) {
        this.emit('update', { error: true, e: e, data: data })
        return console.error(`Could not retrieve message from sysinfo`, e, data)
      }

      this.emit('update', report)
    })
  }

  kill() {
    this.restart = false
    this.process.kill()
  }

  startCollection() {
    this.staticInformations()

    setInterval(() => {
      this.dockerSummary()
    }, 1000)

    setInterval(() => {
      this.servicesSummary()
      this.processesSummary()
    }, 3000)

    this.dockerSummary()
    this.servicesSummary()
    this.processesSummary()

    this.disksStatsWorker()
    this.networkStatsWorker()
    this.memStatsWorker()
    this.cpuStatsWorker()
    this.fdStatsWorker()

    if (process.send) {
      setInterval(() => {
        try {
          process.send(JSON.stringify(this.report()))
        } catch (e) {}
      }, 5000)
    }

    setTimeout(() => {
      try {
        process.send(JSON.stringify(this.report()))
      } catch (e) {}
    }, 1500)
  }

  staticInformations() {
    var getCPU = () => {
      return sysinfo.cpu()
        .then(data => {
          this.infos.cpu = {
            brand: data.manufacturer,
            model: data.brand,
            speed: data.speedmax,
            cores: data.cores,
            physicalCores: data.physicalCores
          }
        })
    }

    var getBaseboard = () => {
      return sysinfo.system()
        .then(data => {
          this.infos.baseboard = {
            manufacturer: data.manufacturer,
            model: data.model,
            version: data.version
          }
        })
    }

    var getOsInfo = () => {
      return sysinfo.osInfo()
        .then(data => {
          this.infos.os = {
            platform: data.platform,
            distro: data.distro,
            release: data.release,
            codename: data.codename,
            kernel: data.kernel,
            arch: data.arch
          }
        })
    }

    var diskLayout = () => {
      return sysinfo.diskLayout()
        .then(disks => {
          disks.forEach((disk) => {
            this.infos.storage.physical_disks.push({
              device: disk.device,
              type: disk.type,
              name: disk.name,
              interfaceType: disk.interfaceType,
              vendor: disk.vendor
            })
          })
        })
    }

    getBaseboard()
      .then(getCPU)
      .then(getOsInfo)
      .then(diskLayout)
      .catch(e => {
        console.error(`Error when trying to retrieve static informations`, e)
      })
  }

  dockerSummary() {
    sysinfo.dockerContainers('all')
      .then(containers => {
        var non_exited_containers = containers.filter(container => container.state != 'exited')
        var new_containers = []

        async.forEach(non_exited_containers, (container, next) => {
          sysinfo.dockerContainerStats(container.id)
            .then(stats => {
              var meta = container

              stats[0].cpu_percent = (stats[0].cpu_percent).toFixed(1)
              stats[0].mem_percent = (stats[0].mem_percent).toFixed(1)
              stats[0].netIO.tx = (stats[0].netIO.tx / DEFAULT_CONVERSION).toFixed(1)
              stats[0].netIO.rx = (stats[0].netIO.rx / DEFAULT_CONVERSION).toFixed(1)

              stats[0].blockIO.w = (stats[0].blockIO.w / DEFAULT_CONVERSION).toFixed(1)
              stats[0].blockIO.r = (stats[0].blockIO.r / DEFAULT_CONVERSION).toFixed(1)

              meta.stats = Array.isArray(stats) == true ? stats[0] : null
              new_containers.push(meta)
              next()
            })
            .catch(e => {
              console.error(e)
              next()
            })
        }, (err) => {
          if (err)
            console.error(err)
          this.infos.containers = new_containers.sort((a, b) => {
            var textA = a.name.toUpperCase();
            var textB = b.name.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
          })
        })
      })
      .catch(e => {
        console.error(e)
      })
  }

  servicesSummary() {
    sysinfo.services('*')
      .then(services => {
        this.infos.services.running = services.filter(service => service.running === true)
        this.infos.services.stopped = services.filter(service => service.running === false)
      })
      .catch(e => {
        console.error(e)
      })
  }

  processesSummary() {
    psList()
      .then(processes => {
        this.infos.processes.cpu_sorted = processes
          .filter(a => !(a.cmd.includes('SystemInfo') && a.cmd.includes('PM2')))
          .sort((a, b) => b.cpu - a.cpu).slice(0, 5)
        this.infos.processes.mem_sorted = processes
          .filter(a => !(a.cmd.includes('SystemInfo') && a.cmd.includes('PM2')))
          .sort((a, b) => b.memory - a.memory).slice(0, 5)
      })
      .catch(e => {
        console.error(`Error when retrieving process list`, e)
      })
  }

  cpuStatsWorker() {
    setInterval(() => {
      sysinfo.cpuTemperature()
        .then(data => {
          this.infos.cpu.temperature = data.main
        })
        .catch(e => {
        })
    }, 5000)

    function fetch () {
      const startMeasure = computeUsage()

      setTimeout(_ => {
        var endMeasure = computeUsage()

        var idleDifference = endMeasure.idle - startMeasure.idle
        var totalDifference = endMeasure.total - startMeasure.total

        var percentageCPU = (10000 - Math.round(10000 * idleDifference / totalDifference)) / 100
        this.infos.cpu.usage = (percentageCPU).toFixed(1)
      }, 100)
    }

    function computeUsage () {
      let totalIdle = 0
      let totalTick = 0
      const cpus = os.cpus()

      for (var i = 0, len = cpus.length; i < len; i++) {
        var cpu = cpus[i]
        for (let type in cpu.times) {
          totalTick += cpu.times[type]
        }
        totalIdle += cpu.times.idle
      }

      return {
        idle: parseInt(totalIdle / cpus.length),
        total: parseInt(totalTick / cpus.length)
      }
    }

    setInterval(fetch.bind(this), 1000)
  }

  memStatsWorker() {
    setInterval(() => {
      sysinfo.mem()
        .then(data => {
          this.infos.mem.total = Math.floor((data.total / DEFAULT_CONVERSION) * 100) / 100
          this.infos.mem.free = Math.floor((data.free / DEFAULT_CONVERSION) * 100) / 100
          this.infos.mem.active = Math.floor((data.active / DEFAULT_CONVERSION) * 100) / 100
        })
        .catch(e => {
          console.error(`Error while getting memory info`, e)
        })
    }, 2000)
  }
  disksStatsWorker() {
    var rx = 0
    var wx = 0
    var started = false

    var filesystemSize = () => {
      sysinfo.fsSize()
        .then(fss => {
          var fse = fss.filter(fs => (fs.size / (1024 * 1024)) > 200)
          this.infos.storage.filesystems = fse
        })
        .catch(e => {
          console.error(`Error while retrieving filesystem infos`, e)
        })
    }

    setInterval(() => {
      filesystemSize()
    }, 30 * 1000)
    filesystemSize()

    setInterval(() => {
      sysinfo.fsStats()
        .then(fs_stats => {
          var new_rx = fs_stats.rx
          var new_wx = fs_stats.wx

          var read = Math.floor((new_rx - rx) / DEFAULT_CONVERSION)
          var write = Math.floor((new_wx - wx) / DEFAULT_CONVERSION)

          if (started == true) {
            this.infos.storage.io.read.add(read)
            this.infos.storage.io.write.add(write)
          }

          rx = new_rx
          wx = new_wx
          started = true
        })
        .catch(e => {
          console.error(`Error while getting network statistics`, e)
        })
    }, 1000)
  }

  fdStatsWorker() {
    var getFDOpened = () => {
      const columnPattern = /(\S+)/mg
      fs.readFile('/proc/sys/fs/file-nr', (err, out) => {
        if (err) return
        const output = out.toString()
        const parsed = columnPattern.exec(output)
        if (parsed.length === 0) return
        const result = parseInt(parsed[0])
        this.infos.fd.opened = result
      })
    }

    setInterval(() => {
      getFDOpened()
    }, 60 * 1000)

    getFDOpened()
  }

  networkStatsWorker() {
    setInterval(() => {
      sysinfo.inetLatency()
        .then(latency => {
          this.infos.network.latency.add(latency)
        })
        .catch(e => {
          console.error(e)
        })
    }, 2000)

    sysinfo.networkInterfaceDefault((net_interface) => {
      var started = false
      var rx = 0
      var tx = 0
      var rx_e = 0
      var tx_e = 0
      var rx_d = 0
      var tx_d = 0

      setInterval(() => {
        sysinfo.networkStats(net_interface)
          .then((net) => {
            var new_rx = (net[0].rx_bytes - rx) / DEFAULT_CONVERSION
            var new_tx = (net[0].tx_bytes - tx) / DEFAULT_CONVERSION
            rx = net[0].rx_bytes
            tx = net[0].tx_bytes

            var new_rx_e = (net[0].rx_errors - rx_e) / DEFAULT_CONVERSION
            var new_tx_e = (net[0].tx_errors - tx_e) / DEFAULT_CONVERSION
            rx_e = net[0].rx_errors
            tx_e = net[0].tx_errors

            var new_rx_d = (net[0].rx_dropped - rx_d) / DEFAULT_CONVERSION
            var new_tx_d = (net[0].tx_dropped - tx_d) / DEFAULT_CONVERSION
            rx_d = net[0].rx_dropped
            tx_d = net[0].tx_dropped

            if (started == true) {
              this.infos.network.rx_5.add(new_rx)
              this.infos.network.tx_5.add(new_tx)
              this.infos.network.rx_errors_60.add(new_rx_e)
              this.infos.network.tx_errors_60.add(new_tx_e)
              this.infos.network.rx_dropped_60.add(new_rx_d)
              this.infos.network.tx_dropped_60.add(new_tx_d)
            }
            started = true
          })
          .catch(e => {
            console.error(`Error on retrieving network stats`, e)
          })
      }, 1000)
    })

  }
}

module.exports = SystemInfo

if (require.main === module) {
  var sys = new SystemInfo()

  //console.log(`System info started`, process.pid)
  sys.startCollection()
}
