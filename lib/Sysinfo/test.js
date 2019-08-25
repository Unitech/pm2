
var sysinfo = require('systeminformation')

var DEFAULT_CONVERSION = 1024 / 1024
var rx = 0, wx = 0
var started = false

sysinfo.dockerContainers('all')
  .then(containers => {
    var non_exited_containers = containers.filter(container => container.state != 'exited')
    console.log(non_exited_containers)
  })

return false
setInterval(() => {
  sysinfo.fsStats()
    .then(fs_stats => {
      var new_rx = fs_stats.rx
      var new_wx = fs_stats.wx

      var read = Math.floor((new_rx - rx) / DEFAULT_CONVERSION)
      var write = Math.floor((new_wx - wx) / DEFAULT_CONVERSION)

      if (started == true) {
        console.log(`R=${read}W=${write}`)
      }

      rx = new_rx
      wx = new_wx
      started = true
    })
    .catch(e => {
      console.error(`Error while getting network statistics`, e)
    })
}, 1000)

return
const psList = require('ps-list');

(async () => {
  psList()
    .then(processes => {
      //console.log(processes)
      console.log(processes.sort((a, b) => { return b.cpu - a.cpu }).slice(0, 4))
      //this.infos.processes.mem_sorted = processes.sort((a, b) => a.mem > b.mem).slice(0, 5)
    })
	//=> [{pid: 3213, name: 'node', cmd: 'node test.js', ppid: 1, uid: 501, cpu: 0.1, memory: 1.5}, …]
})();
