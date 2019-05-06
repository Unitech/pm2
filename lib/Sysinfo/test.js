
var sysinfo = require('systeminformation')
sysinfo.cpuTemperature()
  .then(data => {
    //data.list = data.list.filter(a => a.state == 'running')
    //var procs = data.list.sort((a, b) => { return a.pcpu > b.pcpu})
    //console.log(procs)
    console.log(data)
  })


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
