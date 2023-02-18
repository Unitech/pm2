
const cst = require('../../../constants')
const Common = require('../../Common')
const Configuration = require('../../Configuration')
const UxHelpers = require('./helpers.js')
const chalk = require('chalk')
const Table = require('cli-tableau')
const Passwd = require('../../tools/passwd.js')

const List = {}

const CONDENSED_MODE = (process.stdout.columns || 300) < 120

/**
 * Check if dump file contains same apps that the one managed by PM2
 */
function checkIfProcessAreDumped(list) {
  try {
    var dump_raw = require('fs').readFileSync(cst.DUMP_FILE_PATH)
    var dump = JSON.parse(dump_raw)
    var apps_dumped = dump.map(proc => proc.name)
    var apps_running = list
        .filter(proc => proc.pm2_env.pmx_module != true)
        .map(proc => proc.name)
    var diff = apps_dumped.filter(a => !apps_running.includes(a))
    if (diff.length > 0) {
      Common.warn(`Current process list is not synchronized with saved list. App ${chalk.bold(diff.join(' '))} differs. Type 'pm2 save' to synchronize.`)
    }
    else if (apps_dumped.length != apps_running.length) {
      Common.warn(`Current process list is not synchronized with saved list. Type 'pm2 save' to synchronize.`)
    }
  } catch(e) {
  }
}

var proc_id = 0

/**
 * List Applications and Modules managed by PM2
 */
function listModulesAndAppsManaged(list, commander) {
  var name_col_size = 11

  if (list && list.length > 0)
    name_col_size = (list.reduce((p, c) => (p.name.length > c.name.length) ? p : c)).name.length + 5

  var id_width = Math.max(
    2 + (Math.max(...list.map((l) => String(l.pm2_env.pm_id || 0).length)) || 0),
    4
  );
  
  var app_head = {
    id: id_width,
    name: name_col_size,
    namespace: 13,
    version: 9,
    mode: 9,
    pid: 10,
    uptime: 8,
    '↺': 6,
    status: 11,
    cpu: 10,
    mem: 10,
    user: 10,
    watching: 10
  }

  var mod_head = {
    id: id_width,
    module: 30,
    version: 15,
    pid: 10,
    status: 10,
    '↺': 6,
    cpu: 10,
    mem: 10,
    user: 10
  }

  if (CONDENSED_MODE) {
    app_head = {
      id: id_width,
      name: 20,
      mode: 10,
      '↺': 6,
      status: 11,
      cpu: 10,
      memory: 10
    }

    mod_head = {
      id: id_width,
      name: 20,
      status: 10,
      cpu: 10,
      mem: 10
    }
  }

  var app_table = new Table({
    head : Object.keys(app_head),
    colWidths: Object.keys(app_head).map(k => app_head[k]),
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  })

  var module_table = new Table({
    head : Object.keys(mod_head),
    colWidths: Object.keys(mod_head).map(k => mod_head[k]),
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'],  compact : true}
  })

  var sortField = 'name', sortOrder = 'asc', sort,
      fields = {
        name: 'pm2_env.name',
        namespace: 'pm2_env.namespace',
        pid: 'pid',
        id: 'pm_id',
        cpu: 'monit.cpu',
        memory: 'monit.memory',
        uptime: 'pm2_env.pm_uptime',
        status: 'pm2_env.status'
      }

  if (commander && commander.sort) {
    sort = commander.sort.split(':');

    if(fields[sort[0].toLowerCase()]) {
      sortField = sort[0].toLowerCase();
      sortOrder = sort.length === 2 ? sort[1] : 'asc';
    }
  }

  list.sort(function(a, b) {
    var fieldA = UxHelpers.getNestedProperty(fields[sortField], a)
    var fieldB = UxHelpers.getNestedProperty(fields[sortField], b)

    if (sortOrder === 'desc') {
      if (fieldA > fieldB)
        return -1
      if (fieldA < fieldB)
        return 1
    } else {
      if (fieldA < fieldB)
        return -1
      if (fieldA > fieldB)
        return 1
    }
    return 0
  })

  list.forEach(function(l) {
    var obj = {}

    if (l.pm2_env.pm_id > proc_id) {
      proc_id = l.pm2_env.pm_id
    }

    var mode = l.pm2_env.exec_mode
    var status = l.pm2_env.status
    var key = l.pm2_env.pm_id
    key = chalk.bold.cyan(key)

    if (l.pm2_env.axm_options) {
      var is_tracing_enabled = false

      if (l.pm2_env.axm_options.tracing &&
          typeof(l.pm2_env.axm_options.tracing) == 'boolean' &&
          l.pm2_env.axm_options.tracing == true)
        is_tracing_enabled = true

      if (l.pm2_env.axm_options.tracing &&
          l.pm2_env.axm_options.tracing.enabled &&
          typeof(l.pm2_env.axm_options.tracing.enabled) == 'boolean' &&
          l.pm2_env.axm_options.tracing.enabled == true)
        is_tracing_enabled = true

      if (is_tracing_enabled == true)
        l.pm2_env.name = chalk.green('☵')  + ' ' + l.pm2_env.name

      if (l.pm2_env._km_monitored)
        l.pm2_env.name = chalk.bold.green('◉')  + ' ' + l.pm2_env.name
    }

    if (l.pm2_env.pmx_module == true) {
      if (l.pm2_env.name == 'pm2-sysmonit') return
      // pm2 ls for Modules
      obj[key] = []

      obj[key].push(l.name)

      // Module version + PID
      if (!CONDENSED_MODE) {
        var pid = l.pm2_env.axm_options.pid ? l.pm2_env.axm_options.pid : l.pid
        obj[key].push(l.pm2_env.version || 'N/A', pid)
      }

      // Status
      obj[key].push(UxHelpers.colorStatus(status))

      // Restart
      if (!CONDENSED_MODE)
        obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0)

      // CPU + Memory
      obj[key].push(l.monit ? (l.monit.cpu + '%') : 'N/A', l.monit ? UxHelpers.bytesToSize(l.monit.memory, 1) : 'N/A' )

      // User
      if (!CONDENSED_MODE) {

        if (l.pm2_env.uid && typeof(l.pm2_env.uid) == 'number') {
          // Resolve user id to username
          let users = Passwd.getUsers()
          Object.keys(users).forEach(function(username) {
            var user = users[username]
            if (user.userId == l.pm2_env.uid) {
              l.pm2_env.uid = user.username
            }
          })
        }
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username))
      }

      UxHelpers.safe_push(module_table, obj)
    }
    else {
      // pm2 ls for Applications
      obj[key] = []

      // PM2 ID
      obj[key].push(l.pm2_env.name)

      // Namespace
      if (!CONDENSED_MODE)
        obj[key].push(l.pm2_env.namespace)

      // Version
      if (!CONDENSED_MODE)
        obj[key].push(l.pm2_env.version)

      // Exec mode
      obj[key].push(mode == 'fork_mode' ? chalk.inverse.bold('fork') : chalk.blue.bold('cluster'))

      // PID
      if (!CONDENSED_MODE)
        obj[key].push(l.pid)

      // Uptime
      if (!CONDENSED_MODE)
        obj[key].push((l.pm2_env.pm_uptime && status == 'online') ? UxHelpers.timeSince(l.pm2_env.pm_uptime) : 0)

      // Restart
      obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0)

      // Status
      obj[key].push(UxHelpers.colorStatus(status))


      // CPU
      obj[key].push(l.monit ? l.monit.cpu + '%' : 'N/A')

      // Memory
      obj[key].push(l.monit ? UxHelpers.bytesToSize(l.monit.memory, 1) : 'N/A')

      // User
      if (!CONDENSED_MODE) {
        if (l.pm2_env.uid && typeof(l.pm2_env.uid) == 'number') {
          // Resolve user id to username
          let users = Passwd.getUsers()
          Object.keys(users).forEach(function(username) {
            var user = users[username]
            if (user.userId == l.pm2_env.uid) {
              l.pm2_env.uid = user.username
            }
          })
        }
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username))
      }

      // Watch status
      if (!CONDENSED_MODE)
        obj[key].push(l.pm2_env.watch ? chalk.green.bold('enabled') : chalk.grey('disabled'))

      UxHelpers.safe_push(app_table, obj)
    }

  })

  // Print Applications Managed
  console.log(app_table.toString())

  // Print Modules Managed
  if (module_table.length > 0) {
    console.log(chalk.bold(`Module${module_table.length > 1 ? 's' : ''}`))
    console.log(module_table.toString())
  }

  proc_id++
}

// Container display
function containersListing(sys_infos) {
  var stacked_docker = (process.stdout.columns || 100) < 140

  var docker_head = {
    id: 4,
    image: 50,
    status: 10,
    '↺': 6,
    cpu: 10,
    mem: 10,
    'net I/O ⇵': 11,
    'fs I/O ⇵': 11
  }

  if (stacked_docker) {
    docker_head = {
      id: 4,
      image: 25,
      status: 10,
      cpu: 10,
      mem: 10
    }
  }

  var docker_table = new Table({
    colWidths: Object.keys(docker_head).map(k => docker_head[k]),
    head : Object.keys(docker_head),
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'],  compact : true}
  })

  sys_infos.containers.forEach((c) => {
    var cpu = c.stats.cpu_percent
    var mem = c.stats.mem_percent == 0 ? '0' : c.stats.mem_percent
    var id = chalk.bold.cyan(proc_id++)
    var state = UxHelpers.colorStatus(c.state)

    if (stacked_docker)
      docker_table.push([id, c.image, state, `${cpu}%`, `${mem}mb`])
    else {
      docker_table.push([
        id,
        c.image,
        state,
        c.restartCount,
        `${cpu == 0 ? '0' : cpu}%`,
        `${mem}mb`,
        `${c.stats.netIO.rx}/${isNaN(c.stats.netIO.tx) == true ? '0.0' : c.stats.netIO.tx}`,
        `${c.stats.blockIO.r}/${c.stats.blockIO.w}`
      ])
    }
  })

  console.log(chalk.bold(`Container${sys_infos.containers.length > 1 ? 's' : ''}`))
  console.log(docker_table.toString())
}

/**
 * High resource processes
 */
function listHighResourcesProcesses(sys_infos) {
  const CPU_MIN_SHOW = 60
  const MEM_MIN_SHOW = 30

  var sys_proc_head = ['id', 'cmd', 'pid', 'cpu', 'mem', 'uid']

  var sys_proc_table = new Table({
    colWidths: [4, CONDENSED_MODE ? 29 : 77, 10, 10, 10, 8],
    head : sys_proc_head,
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'],  compact : true}
  })

  sys_infos.processes.cpu_sorted = sys_infos.processes.cpu_sorted.filter((proc) => {
    return proc.cpu > CPU_MIN_SHOW && proc.cmd.includes('node') === false &&
      proc.cmd.includes('God Daemon') === false
  })

  sys_infos.processes.cpu_sorted.forEach(proc => {
    var cpu = `${UxHelpers.colorizedMetric(proc.cpu, 40, 70, '%')}`
    var mem = `${UxHelpers.colorizedMetric(proc.memory, 40, 70, '%')}`
    var cmd = proc.cmd
    sys_proc_table.push([chalk.bold.cyan(proc_id++), cmd, proc.pid, cpu, mem, proc.uid])
  })

  sys_infos.processes.mem_sorted = sys_infos.processes.mem_sorted.filter((proc) => {
    return proc.memory > MEM_MIN_SHOW && proc.cmd.includes('node') == false
  })

  sys_infos.processes.mem_sorted.forEach((proc) => {
    var cpu = `${UxHelpers.colorizedMetric(proc.cpu, 40, 70, '%')}`
    var mem = `${UxHelpers.colorizedMetric(proc.memory, 40, 70, '%')}`
    var cmd = proc.cmd
    // if (proc.cmd.length > 50)
    //   cmd = '…' + proc.cmd.slice(proc.cmd.length - 48, proc.cmd.length)
    sys_proc_table.push([chalk.bold.cyan(proc_id++), cmd, proc.pid, cpu, mem, proc.uid])
  })

  if (sys_infos.processes.cpu_sorted.length >= 1 || sys_infos.processes.mem_sorted.length >= 1) {
    console.log(chalk.bold('Intensive Processes'))
    console.log(sys_proc_table.toString())
  }
}

/**
 * Sys info line
 */
function miniMonitBar(sys_infos) {
  let sys_metrics = sys_infos.pm2_env.axm_monitor

  let cpu = sys_metrics['CPU Usage']

  if (typeof(cpu) == 'undefined') return

  var sys_summary_line = `${chalk.bold.cyan('host metrics')} `
  sys_summary_line += `| ${chalk.bold('cpu')}: ${UxHelpers.colorizedMetric(cpu.value, 40, 70, '%')}`

  let temp = sys_metrics['CPU Temperature'].value
  if (temp && temp != '-1') {
    sys_summary_line += ` ${UxHelpers.colorizedMetric(temp, 50, 70, 'º')}`
  }

  let mem_total = sys_metrics['RAM Total'].value
  let mem_available = sys_metrics['RAM Available'].value

  if (mem_total) {
    var perc_mem_usage = (((mem_available) / mem_total) * 100).toFixed(1)
    sys_summary_line += ` | ${chalk.bold('mem free')}: ${UxHelpers.colorizedMetric(perc_mem_usage, 30, 10, '%')} `
  }

  let interfaces = Object.keys(sys_metrics).filter(m => m.includes('net') && m != 'net:default').map(i => i.split(':')[2]).filter((iface, i, self) => self.indexOf(iface) === i)

  interfaces.forEach(iface => {
    if (!sys_metrics[`net:rx_5:${iface}`]) return
    sys_summary_line += `| ${chalk.bold(iface)}: `
    sys_summary_line += `⇓ ${UxHelpers.colorizedMetric(sys_metrics[`net:rx_5:${iface}`].value, 10, 20, 'mb/s')} `
    sys_summary_line += `⇑ ${UxHelpers.colorizedMetric(sys_metrics[`net:tx_5:${iface}`].value, 10, 20, 'mb/s')} `
  })

  if (CONDENSED_MODE == false) {
    let read = sys_metrics['Disk Reads'].value
    let write = sys_metrics['Disk Writes'].value

    sys_summary_line += `| ${chalk.bold('disk')}: ⇓ ${UxHelpers.colorizedMetric(read, 10, 20, 'mb/s')}`
    sys_summary_line += ` ⇑ ${UxHelpers.colorizedMetric(write, 10, 20, 'mb/s')} `

    let disks = Object.keys(sys_metrics).filter(m => m.includes('fs:')).map(i => i.split(':')[2]).filter((iface, i, self) => self.indexOf(iface) === i)
    var disk_nb = 0

    disks.forEach(fs => {
      let use = sys_metrics[`fs:use:${fs}`].value
      if (use > 60)
        sys_summary_line += `${chalk.grey(fs)} ${UxHelpers.colorizedMetric(use, 80, 90, '%')} `
    })
  }

  sys_summary_line += '|'
  console.log(sys_summary_line)
}

/**
 * pm2 ls
 * @method dispAsTable
 * @param {Object} list
 * @param {Object} system informations (via pm2 sysmonit/pm2 sysinfos)
 */
module.exports = function(list, commander) {
  var pm2_conf = Configuration.getSync('pm2')

  if (!list)
    return console.log('list empty')

  listModulesAndAppsManaged(list, commander)

  let sysmonit = list.filter(proc => proc.name == 'pm2-sysmonit')
  if (sysmonit && sysmonit[0])
    miniMonitBar(sysmonit[0])

  checkIfProcessAreDumped(list)
}
