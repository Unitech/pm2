
const UxHelpers = require('./helpers.js')
const p = require('path')

/**
 * Minimal display via pm2 ls -m
 * @method miniDisplay
 * @param {Object} list process list
 */
module.exports = function(list) {
  list.forEach(function(l) {

    var mode = l.pm2_env.exec_mode.split('_mode')[0]
    var status = l.pm2_env.status
    var key = l.pm2_env.name || p.basename(l.pm2_env.pm_exec_path.script)

    console.log('+--- %s', key)
    console.log('namespace : %s', l.pm2_env.namespace)
    console.log('version : %s', l.pm2_env.version)
    console.log('pid : %s', l.pid)
    console.log('pm2 id : %s', l.pm2_env.pm_id)
    console.log('status : %s', status)
    console.log('mode : %s', mode)
    console.log('restarted : %d', l.pm2_env.restart_time ? l.pm2_env.restart_time : 0)
    console.log('uptime : %s', (l.pm2_env.pm_uptime && status == 'online') ? UxHelpers.timeSince(l.pm2_env.pm_uptime) : 0)
    console.log('memory usage : %s', l.monit ? UxHelpers.bytesToSize(l.monit.memory, 1) : '')
    console.log('error log : %s', l.pm2_env.pm_err_log_path)
    console.log('watching : %s', l.pm2_env.watch ? 'yes' : 'no')
    console.log('PID file : %s\n', l.pm2_env.pm_pid_path)
  })
}
