
const PM2 = require('./../../API.js')
const psList = require('../psList.js')
const _ = require('lodash')

const SERVICES_ASSOCIATION = {
  'mongodb,mongo': {
    module: 'pm2-mongodb'
  },
  'redis,redis-server': {
    module: 'pm2-redis'
  },
  'elasticsearch': {
    module: 'pm2-elasticsearch'
  },
  'docker': {
    module: 'pm2-monit-docker'
  },
  'consul': {
    module:'pm2-monit-consul'
  },
  'pm2': {
    module: 'pm2-probe'
  },
  'fpm': {
    module: 'pm2-php-fpm'
  }
}

// 'python,python3': {
//   module: 'pm2-python'
// },
// 'nginx': {
//   module: 'pm2-monit-nginx'
// },
// 'haproxy': {
//   module: 'pm2-monit-haproxy'
// },
// 'traeffik': {
//   module: 'pm2-monit-traeffik'
// }

class ServicesDetection {
  constructor() {
    this.pm2 = new PM2()
  }

  startDetection(cb = () => {}) {
    // Check running probes
    this.monitoredServices((err, pm2_services) => {
      // Check running services
      this.discover((err, required_modules) => {
        var required_monitoring_probes = Object.keys(required_modules)
        // Make the diff between
        console.log(`Need to start following modules:`)
        console.log(_.difference(required_monitoring_probes, pm2_services))
        this.pm2.install('pm2-server-monit', (err, apps) => {
          cb()
        })
      })
    })
  }

  monitoredServices(cb) {
    var f_proc_list = []

    this.pm2.list((err, proc_list) => {
      f_proc_list = proc_list.map(p => {
        return p.name
      })
      this.pm2.close()
      cb(err, f_proc_list)
    })
  }

  discover(cb) {
    psList()
      .then(processes => {
        var supported_systems = Object.keys(SERVICES_ASSOCIATION)
        var required_modules = {}

        processes.forEach((proc) => {
          supported_systems.forEach(sup_sys => {
            var proc_names = sup_sys.split(',')
            proc_names.forEach(proc_name => {
              if (proc.name.includes(proc_name) === true ||
                  proc.cmd.includes(proc_name) === true) {
                var key = SERVICES_ASSOCIATION[sup_sys].module
                required_modules[key] = SERVICES_ASSOCIATION[sup_sys]
                required_modules[key].monit = proc
              }
            })
          })
        })
        return cb(null, required_modules)
      })
      .catch(e => {
        console.error(`Error while listing processes`, e)
      })
  }
}

if (require.main === module) {
  var serviceDetection = new ServicesDetection()

  var process = (done) => {
    serviceDetection.startDetection((err, procs) => {
      done()
    })
  }

  var iterate = () => {
    process(() => {
      setTimeout(iterate, 3000)
    })
  }

  iterate()
}
