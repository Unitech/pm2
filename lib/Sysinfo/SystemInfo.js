
const sysinfo = require('systeminformation')
const async = require('async')
const MeanCalc = require('./MeanCalc.js')
const spawn = require('child_process').spawn
const fork = require('child_process').fork
const DEFAULT_CONVERSION = 1024 * 1024
const EventEmitter = require('events')

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
        processors: null
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
        running: null,
        blocked: null
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
      this.servicesSummary()
      this.processesSummary()
    }, 5000)
    this.dockerSummary()
    this.servicesSummary()
    this.processesSummary()

    this.disksStatsWorker()
    this.networkStatsWorker()
    this.memStatsWorker()

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
          this.infos.containers = new_containers
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
    // issues on getting chrome cpu usage every time
    sysinfo.processes()
      .then(processes => {
        this.infos.processes.running = processes.list.filter(proc => proc.state === 'running')
        this.infos.processes.blocked = processes.list.filter(proc => proc.state === 'blocked')
      })
      .catch(e => {
        console.error(e)
      })
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
