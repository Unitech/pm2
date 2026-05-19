
const sysinfo = require('systeminformation')
const psList = require('./psList.js')
const async = require('async')
const MeanCalc = require('./MeanCalc.js')
const DEFAULT_CONVERSION = 1024 * 1024
const os = require('os')
const fs = require('fs')
const debug = require('debug')('pm2:sysinfos')

class SystemInfo {
  constructor() {
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
        load: null,
        loads: null
      },
      graphics: {
        model: null,
        driverVersion: null,
        memTotal: null,
        memUsed: null,
        temperature: null
      },
      mem: {
        total: null,
        free: null,
        active: null,
        usage: null
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
        opened: null,
        max: null
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
      connections: ['source_ip:source_port-dest_ip:dest_port-proc_name'],
      default_interface: null,
      network: {},
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
  }

  // Cast MeanCalc and other object to real value
  // This method retrieve the machine snapshot well formated
  report() {
    var report = JSON.parse(JSON.stringify(this.infos))

    Object.keys(report.network).forEach(iname => {
      report.network[iname] = {
        ip4: this.infos.network[iname].ip4,
        ip6: this.infos.network[iname].ip6,
        tx_5: this.infos.network[iname].tx_5.val(),
        rx_5: this.infos.network[iname].rx_5.val(),
        rx_errors_60: this.infos.network[iname].rx_errors_60.val(),
        tx_errors_60: this.infos.network[iname].tx_errors_60.val(),
        rx_dropped_60: this.infos.network[iname].rx_dropped_60.val(),
        tx_dropped_60: this.infos.network[iname].tx_dropped_60.val()
      }
    })

    report.storage.io.read = this.infos.storage.io.read.val()
    report.storage.io.write = this.infos.storage.io.write.val()
    return report
  }

  query(cb) {
    if (this.process.connected == true) {
      try {
        this.process.send('query')
      } catch(e) {
        return cb(new Error('not ready yet'), null)
      }
    }
    else
      return cb(new Error('not ready yet'), null)

    var res = (msg) => {
      try {
        msg = JSON.parse(msg)
      }
      catch (e) {
      }

      if (msg.cmd == 'query:res') {
        listener.removeListener('message', res)
        return cb(null, msg.data)
      }
    }

    var listener = this.process.on('message', res)
  }

  startCollection() {
    this.staticInformations()

    var dockerCollection, processCollection, memCollection,
        servicesCollection, graphicsCollection

    (dockerCollection = () => {
      this.dockerSummary(() => {
        setTimeout(dockerCollection.bind(this), 5000)
      })
    })();

    (processCollection = () => {
      this.processesSummary(() => {
        setTimeout(processCollection.bind(this), 5000)
      })
    })();

    (graphicsCollection = () => {
      this.graphicsInformations(() => {
        setTimeout(graphicsCollection.bind(this), 20000)
      })
    })();

    (servicesCollection = () => {
      this.servicesSummary(() => {
        setTimeout(servicesCollection.bind(this), 60000)
      })
    })();

    (memCollection = () => {
      this.memStats(() => {
        setTimeout(memCollection.bind(this), 1000)
      })
    })();

    //this.networkConnectionsWorker()
    this.disksStatsWorker()
    this.networkStatsWorker()

    this.cpuStatsWorker()
    this.fdStatsWorker()

    // Systeminfo receive command
    process.on('message', (cmd) => {
      if (cmd == 'query') {
        try {
          var res = JSON.stringify({
            cmd: 'query:res',
            data: this.report()
          })
          process.send(res)
        } catch (e) {
          console.error('Could not retrieve system informations', e)
        }
      }
      else if (cmd == 'pong') {
        clearTimeout(this.ping_timeout)
      }
    })

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


    var getDefaultNetInterface = () => {
      return sysinfo.networkInterfaceDefault()
        .then(iface => {
          this.infos.default_interface = iface
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
      this.infos.storage.physical_disks = []

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
      .then(getDefaultNetInterface)
      .catch(e => {
        debug(`Error when trying to retrieve static informations`, e)
      })
  }

  dockerSummary(cb = () => {}) {
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
              debug(e)
              next()
            })
        }, (err) => {
          if (err)
            debug(err)
          this.infos.containers = new_containers.sort((a, b) => {
            var textA = a.name.toUpperCase();
            var textB = b.name.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
          })
          return cb()
        })
      })
      .catch(e => {
        debug(e)
        return cb()
      })
  }

  servicesSummary() {
    sysinfo.services('*')
      .then(services => {
        this.infos.services.running = services.filter(service => service.running === true)
        this.infos.services.stopped = services.filter(service => service.running === false)
      })
      .catch(e => {
        debug(e)
      })
  }

  processesSummary(cb) {
    psList()
      .then(processes => {
        this.infos.processes.cpu_sorted = processes
          .filter(a => !(a.cmd.includes('SystemInfo') && a.cmd.includes('PM2')))
          .sort((a, b) => b.cpu - a.cpu).slice(0, 5)
        this.infos.processes.mem_sorted = processes
          .filter(a => !(a.cmd.includes('SystemInfo') && a.cmd.includes('PM2')))
          .sort((a, b) => b.memory - a.memory).slice(0, 5)
        return cb()
      })
      .catch(e => {
        console.error(`Error when retrieving process list`, e)
        return cb()
      })
  }

  graphicsInformations(cb) {
    sysinfo.graphics()
      .then(data => {
        if (!data) return cb()
        let cg1 = data.controllers[0]
        if (!cg1) return cb()

        this.infos.graphics = {
          model: cg1.model,
          driverVersion: cg1.driverVersion,
          memTotal: cg1.memoryTotal,
          memUsed: cg1.memoryUsed,
          temperature: cg1.temperatureGpu
        }
        return cb()
      })
      .catch(e => {
        console.error(`Error while retrieving graphics informations`)
        console.error(e)
        return cb()
      })
  }

  cpuStatsWorker() {
    var cpuTempCollection, cpuLoad

    (cpuTempCollection = () => {
      sysinfo.cpuTemperature()
        .then(data => {
          this.infos.cpu.temperature = (data.main).toFixed(1)
          setTimeout(cpuTempCollection.bind(this), 5000)
        })
        .catch(e => {
          setTimeout(cpuTempCollection.bind(this), 5000)
        })
    })();

    (cpuLoad = () => {
      sysinfo.currentLoad()
        .then(data => {
          this.infos.cpu.load = data.currentLoad.toFixed(1)
          this.infos.cpu.loads = data.cpus.map(cpu => Math.floor(cpu.load)).join('|')
          setTimeout(cpuLoad.bind(this), 1000)
        })
        .catch(e => {
          setTimeout(cpuLoad.bind(this), 1000)
        })
    })();
  }

  memStats(cb) {
    sysinfo.mem()
      .then(data => {
        this.infos.mem.total = (data.total / DEFAULT_CONVERSION / 1024).toFixed(2)
        this.infos.mem.free = (data.free / DEFAULT_CONVERSION / 1024).toFixed(2)
        this.infos.mem.active = (data.active / DEFAULT_CONVERSION / 1024).toFixed(2)
        this.infos.mem.available = (data.available / DEFAULT_CONVERSION / 1024).toFixed(2)
        this.infos.mem.usage = ((data.active / data.total) * 100).toFixed(1)
        return cb()
      })
      .catch(e => {
        console.error(`Error while retrieving memory info`)
        console.error(e)
        return cb()
      })
  }

  networkConnectionsWorker() {
    var retrieveConn

    (retrieveConn = () => {
      sysinfo.networkConnections()
        .then(conns => {
          this.infos.connections = conns
            .filter(conn => conn.localport != '443' && conn.peerport != '443')
            .map(conn => `${conn.localaddress}:${conn.localport}-${conn.peeraddress}:${conn.peerport}-${conn.proc ? conn.proc : 'unknown'}`)
          setTimeout(retrieveConn.bind(this), 10 * 1000)
        })
        .catch(e => {
          console.error(`Error while retrieving filesystems info`)
          console.error(e)
          setTimeout(retrieveConn.bind(this), 10 * 1000)
        })
    })();
  }

  disksStatsWorker() {
    var rx = 0
    var wx = 0
    var started = false
    var fsSizeCollection, ioCollection

    (fsSizeCollection = () => {
      sysinfo.fsSize()
        .then(fss => {
          // Get only partition of > 800 and not /boot
          var fse = fss.filter(fs => ((fs.size / (1024 * 1024)) > 800) && fs.mount != '/boot' && !fs.mount.includes('efi'))
          this.infos.storage.filesystems = fse
          setTimeout(fsSizeCollection.bind(this), 30 * 1000)
        })
        .catch(e => {
          console.error(`Error while retrieving filesystem infos (FSSIZE)`, e)
          setTimeout(fsSizeCollection.bind(this), 10 * 1000)
        })
    })();

    (ioCollection = () => {
      sysinfo.fsStats()
        .then(fs_stats => {
          var new_rx = fs_stats.rx
          var new_wx = fs_stats.wx

          var read = ((new_rx - rx) / DEFAULT_CONVERSION).toFixed(3)
          var write = ((new_wx - wx) / DEFAULT_CONVERSION).toFixed(3)

          if (started == true) {
            this.infos.storage.io.read.add(parseFloat(read))
            this.infos.storage.io.write.add(parseFloat(write))
          }

          rx = new_rx
          wx = new_wx
          started = true
          setTimeout(ioCollection.bind(this), 1000)
        })
        .catch(e => {
          console.error(`Error while getting network statistics`, e)
          setTimeout(ioCollection.bind(this), 1000)
        })
    })();
  }

  fdStatsWorker() {
    var getFDOpened = () => {
      sysinfo.fsOpenFiles()
        .then(open_files => {
          this.infos.fd.opened = open_files.allocated
          this.infos.fd.max = open_files.max
        })
        .catch(e => {
          console.error(`Could not retrieve fds`)
          console.error(e)
        })
    }

    setInterval(() => {
      getFDOpened()
    }, 5000)

    getFDOpened()
  }

  networkStatsWorker() {
    var latencyCollection, networkStatsCollection
    var self = this

    function grabStats(inter) {
      let started = false
      let rx = 0
      let tx = 0
      let rx_e = 0
      let tx_e = 0
      let rx_d = 0
      let tx_d = 0
      let net_interface = inter.iface;

      function networkStatsCollection(net_interface) {

        self.infos.network[net_interface] = {
          ip4: inter.ip4,
          ip6: inter.ip6,
          latency: new MeanCalc(5),
          tx_5: new MeanCalc(5),
          rx_5: new MeanCalc(5),
          rx_errors_60: new MeanCalc(60),
          tx_errors_60: new MeanCalc(60),
          tx_dropped_60: new MeanCalc(60),
          rx_dropped_60: new MeanCalc(60)
        }

        sysinfo.networkStats(net_interface)
          .then((net) => {
            let new_rx = (net[0].rx_bytes - rx) / DEFAULT_CONVERSION
            let new_tx = (net[0].tx_bytes - tx) / DEFAULT_CONVERSION
            rx = net[0].rx_bytes
            tx = net[0].tx_bytes

            let new_rx_e = (net[0].rx_errors - rx_e) / DEFAULT_CONVERSION
            let new_tx_e = (net[0].tx_errors - tx_e) / DEFAULT_CONVERSION
            rx_e = net[0].rx_errors
            tx_e = net[0].tx_errors

            let new_rx_d = (net[0].rx_dropped - rx_d) / DEFAULT_CONVERSION
            let new_tx_d = (net[0].tx_dropped - tx_d) / DEFAULT_CONVERSION
            rx_d = net[0].rx_dropped
            tx_d = net[0].tx_dropped

            if (started == true) {
              self.infos.network[net_interface].rx_5.add(new_rx)
              self.infos.network[net_interface].tx_5.add(new_tx)
              self.infos.network[net_interface].rx_errors_60.add(new_rx_e)
              self.infos.network[net_interface].tx_errors_60.add(new_tx_e)
              self.infos.network[net_interface].rx_dropped_60.add(new_rx_d)
              self.infos.network[net_interface].tx_dropped_60.add(new_tx_d)
            }
            started = true
            setTimeout(() => {
              networkStatsCollection(net_interface)
            }, 1000)
          })
          .catch(e => {
            console.error(`Error on retrieving network stats`, e)
            setTimeout(() => {
              networkStatsCollection(net_interface)
            }, 1000)
          })
      }

      networkStatsCollection(net_interface)
    }

    sysinfo.networkInterfaces()
      .then(interfaces => {
        interfaces.forEach(inter => {
          if (inter.ip4 == '127.0.0.1') return
          grabStats(inter)
        })
      })
      .catch(e => {
        console.error(`Cannot retrieve interfaces`)
        console.error(e)
      })


    // (latencyCollection = () => {
    //   sysinfo.inetLatency()
    //     .then(latency => {
    //       this.infos.network.latency.add(latency)
    //       setTimeout(latencyCollection.bind(this), 2000)
    //     })
    //     .catch(e => {
    //       debug(e)
    //       setTimeout(latencyCollection.bind(this), 2000)
    //     })
    // })()



  }
}

module.exports = SystemInfo

if (require.main === module) {
  var sys = new SystemInfo()
  sys.startCollection()

  setInterval(() => {
    console.log(JSON.stringify(sys.report(), null, 2))
  }, 5000)
}
