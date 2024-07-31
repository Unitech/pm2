const Table = require('cli-tableau')
const chalk = require('chalk')
const UxHelpers = require('./helpers.js')
const Common = require('../../Common.js')

var postModuleInfos = function(module_name, human_info) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  })

  var disp = {}

  human_info.unshift(['Module name', module_name])
  human_info.forEach(function(info) {
    var obj = {}
    obj[chalk.bold.cyan(info[0])] = info[1]
    table.push(obj)
  })

  console.log()
  console.log(chalk.bold.inverse(' Module %s infos '), module_name)
  console.log(table.toString())
}

/**
 * Description
 * @method describeTable
 * @param {Object} proc process list
 */
module.exports = function(proc) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  })

  var pm2_env = proc.pm2_env

  var created_at = 'N/A'

  if (pm2_env.axm_options && pm2_env.axm_options.human_info) {
    postModuleInfos(pm2_env.name, pm2_env.axm_options.human_info)
  }

  try {
    if (pm2_env.created_at != null)
      created_at = new Date(pm2_env.created_at).toISOString()
  } catch (e) {
  }

  console.log(chalk.bold.inverse(' Describing process with id %d - name %s '), pm2_env.pm_id, pm2_env.name)
  UxHelpers.safe_push(table,
            { 'status' : UxHelpers.colorStatus(pm2_env.status) },
            { 'name': pm2_env.name },
            { 'namespace': pm2_env.namespace },
            { 'version': pm2_env.version },
            { 'restarts' : pm2_env.restart_time },
            { 'uptime' : (pm2_env.pm_uptime && pm2_env.status == 'online') ? UxHelpers.timeSince(pm2_env.pm_uptime) : 0 },
            { 'script path' : pm2_env.pm_exec_path },
            { 'script args' : pm2_env.args ? (typeof pm2_env.args == 'string' ? JSON.parse(pm2_env.args.replace(/'/g, '"')):pm2_env.args).join(' ') : null },
            { 'error log path' : pm2_env.pm_err_log_path },
            { 'out log path' : pm2_env.pm_out_log_path },
            { 'pid path' : pm2_env.pm_pid_path },

            { 'interpreter' : pm2_env.exec_interpreter },
            { 'interpreter args' : pm2_env.node_args.length != 0 ? pm2_env.node_args : null },

            { 'script id' : pm2_env.pm_id },
            { 'exec cwd' : pm2_env.pm_cwd },

            { 'exec mode' : pm2_env.exec_mode },
            { 'node.js version' : pm2_env.node_version },
            { 'node env': pm2_env.env.NODE_ENV },
            { 'watch & reload' : pm2_env.watch ? chalk.green.bold('✔') : '✘' },
            { 'unstable restarts' : pm2_env.unstable_restarts },
            { 'created at' : created_at }
           )

  if ('pm_log_path' in pm2_env){
    table.splice(6, 0, {'entire log path': pm2_env.pm_log_path})
  }

  if ('cron_restart' in pm2_env){
    if ('cron_timezone' in pm2_env){
      table.splice(5, 0, {'cron timezone': pm2_env.cron_timezone})
    }
    table.splice(5, 0, {'cron restart': pm2_env.cron_restart})
  }

  console.log(table.toString())

  /**
   * Module conf display
   */
  if (pm2_env.axm_options &&
      pm2_env.axm_options.module_conf &&
      Object.keys(pm2_env.axm_options.module_conf).length > 0) {
    var table_conf = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    })
    console.log('Process configuration')

    Object.keys(pm2_env.axm_options.module_conf).forEach(function(key) {
      var tmp = {}
      tmp[key] = pm2_env.axm_options.module_conf[key]
      UxHelpers.safe_push(table_conf, tmp)
    })

    console.log(table_conf.toString())
  }

  /**
   * Versioning metadata
   */
  if (pm2_env.versioning) {

    var table2 = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    })

    console.log(chalk.inverse.bold(' Revision control metadata '))
    UxHelpers.safe_push(table2,
              { 'revision control' : pm2_env.versioning.type },
              { 'remote url' : pm2_env.versioning.url },
              { 'repository root' : pm2_env.versioning.repo_path },
              { 'last update' : pm2_env.versioning.update_time },
              { 'revision' : pm2_env.versioning.revision },
              { 'comment' :  pm2_env.versioning.comment ? pm2_env.versioning.comment.trim().slice(0, 60) : '' },
              { 'branch' :  pm2_env.versioning.branch }
             )
    console.log(table2.toString())
  }

  if (pm2_env.axm_actions && Object.keys(pm2_env.axm_actions).length > 0) {
    var table_actions = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    })

    console.log(chalk.inverse.bold(' Actions available '))
    pm2_env.axm_actions.forEach(function(action_set) {
      UxHelpers.safe_push(table_actions, [action_set.action_name])
    })

    console.log(table_actions.toString())
    Common.printOut(chalk.white.italic(' Trigger via: pm2 trigger %s <action_name>\n'), pm2_env.name)
  }

  if (pm2_env.axm_monitor && Object.keys(pm2_env.axm_monitor).length > 0) {
    var table_probes = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    })

    console.log(chalk.inverse.bold(' Code metrics value '))
    Object.keys(pm2_env.axm_monitor).forEach(function(key) {
      var obj = {}
      var metric_name = pm2_env.axm_monitor[key].hasOwnProperty("value") ? pm2_env.axm_monitor[key].value : pm2_env.axm_monitor[key]
      var metric_unit = pm2_env.axm_monitor[key].hasOwnProperty("unit") ? pm2_env.axm_monitor[key].unit : ''
      var value = `${metric_name} ${metric_unit}`
      obj[key] = value
      UxHelpers.safe_push(table_probes, obj)
    })

    console.log(table_probes.toString())
  }

  var table_env = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  })

  console.log(chalk.inverse.bold(' Divergent env variables from local env '))

  var _env = Common.safeExtend({}, pm2_env)
  var diff_env = {}

  Object.keys(process.env).forEach(k => {
    if (!_env[k] || _env[k] != process.env[k]) {
      diff_env[k] = process.env[k]
    }
  })

  Object.keys(diff_env).forEach(function(key) {
    var obj = {}
    if (_env[key]) {
      // 1. fix env value is not a String and slice is undeinfed
      // 2. fix process.stdout.columns is undefined and causes empty string output
      // 3. columns defaults to 300 - same as specified in pm2-ls
      obj[key] = String(_env[key]).slice(0, (process.stdout.columns || 300) - 60)
      UxHelpers.safe_push(table_env, obj)
    }
  })

  console.log(table_env.toString())
  console.log()
  Common.printOut(chalk.white.italic(' Add your own code metrics: http://bit.ly/code-metrics'))
  Common.printOut(chalk.white.italic(' Use `pm2 logs %s [--lines 1000]` to display logs'), pm2_env.name)
  Common.printOut(chalk.white.italic(' Use `pm2 env %s` to display environment variables'), pm2_env.pm_id)
  Common.printOut(chalk.white.italic(' Use `pm2 monit` to monitor CPU and Memory usage'), pm2_env.name)
}
