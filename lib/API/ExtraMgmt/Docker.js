
const util = require('util')
const spawn = require('child_process').spawn
const DockerMgmt = {}

module.exports = DockerMgmt

function execDocker(cmd, cb) {
  var i = spawn('docker', cmd, {
    stdio : 'inherit',
    env: process.env,
		shell : true
  })

  i.on('close', cb)
}

DockerMgmt.processCommand = function(PM2, start_id, select_id, action, cb) {
  PM2.Client.executeRemote('getSystemData', {}, (err, sys_infos) => {
    if (sys_infos.containers && sys_infos.containers.length == 0)
      return cb(new Error(`Process ${select_id} not found`))
    var container = sys_infos.containers[select_id - start_id - 1]
    if (action == 'stopProcessId')
      execDocker(['stop', container.id], cb)
    if (action == 'deleteProcessId')
      execDocker(['rm', container.id], cb)
    if (action == 'restartProcessId')
      execDocker(['restart', container.id], cb)
  })
}
