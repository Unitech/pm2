'use strict'
/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var Table         = require('cli-table-redemption');
var p             = require('path');
var chalk         = require('chalk');
var Common        = require('../Common');
var Spinner       = require('./Spinner.js');
var UX = module.exports = {};
var Passwd = require('../tools/passwd.js')
var Configuration = require('../Configuration.js')

/**
 * Description
 * @method miniDisplay
 * @param {} list
 * @return
 */
UX.miniDisplay = function(list) {
  list.forEach(function(l) {

    var mode = l.pm2_env.exec_mode.split('_mode')[0];
    var status = l.pm2_env.status;
    var key = l.pm2_env.name || p.basename(l.pm2_env.pm_exec_path.script);

    console.log('+--- %s', key);
    console.log('version : %s', l.pm2_env.version);
    console.log('pid : %s', l.pid);
    console.log('pm2 id : %s', l.pm2_env.pm_id);
    console.log('status : %s', status);
    console.log('mode : %s', mode);
    console.log('restarted : %d', l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);
    console.log('uptime : %s', (l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0);
    console.log('memory usage : %s', l.monit ? UX.bytesToSize(l.monit.memory, 1) : '');
    console.log('error log : %s', l.pm2_env.pm_err_log_path);
    console.log('watching : %s', l.pm2_env.watch ? 'yes' : 'no');
    console.log('PID file : %s\n', l.pm2_env.pm_pid_path);
  });
};

UX.postModuleInfos = function(module_name, human_info) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  var disp = {};

  human_info.unshift(['Module name', module_name]);
  human_info.forEach(function(info) {
    var obj = {};
    obj[chalk.bold.cyan(info[0])] = info[1];
    table.push(obj);
  });

  console.log();
  console.log(chalk.bold.inverse(' Module %s infos '), module_name);
  console.log(table.toString());
};

/**
 * Description
 * @method describeTable
 * @param {} process
 * @return
 */
UX.describeTable = function(proc) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  var pm2_env = proc.pm2_env;

  var created_at = 'N/A';

  if (pm2_env.axm_options && pm2_env.axm_options.human_info) {
    this.postModuleInfos(pm2_env.name, pm2_env.axm_options.human_info);
  }

  try {
    if (pm2_env.created_at != null)
      created_at = new Date(pm2_env.created_at).toISOString();
  } catch (e) {
    //throw new Error(pm2_env.created_at + ' is not a valid date: '+e.message, e.fileName, e.lineNumber);
  }

  console.log(chalk.bold.inverse(' Describing process with id %d - name %s '), pm2_env.pm_id, pm2_env.name);
  safe_push(table,
            { 'status' : colorStatus(pm2_env.status) },
            { 'name': pm2_env.name },
            { 'version': pm2_env.version },
            { 'restarts' : pm2_env.restart_time },
            { 'uptime' : (pm2_env.pm_uptime && pm2_env.status == 'online') ? timeSince(pm2_env.pm_uptime) : 0 },
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
           );

  if ('pm_log_path' in pm2_env){
    table.splice(6, 0, {'entire log path': pm2_env.pm_log_path});
  }

  if ('cron_restart' in pm2_env){
    table.splice(5, 0, {'cron restart': pm2_env.cron_restart});
  }

  console.log(table.toString());

  /**
   * Module conf display
   */
  if (pm2_env.axm_options &&
      pm2_env.axm_options.module_conf &&
      Object.keys(pm2_env.axm_options.module_conf).length > 0) {
    var table_conf = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    });
    console.log('Process configuration');

    Object.keys(pm2_env.axm_options.module_conf).forEach(function(key) {
      var tmp = {};
      tmp[key] = pm2_env.axm_options.module_conf[key];
      safe_push(table_conf, tmp);
    });

    console.log(table_conf.toString());
  }

  /**
   * Versioning metadata
   */
  if (pm2_env.versioning) {

    var table2 = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    });

    console.log(chalk.inverse.bold(' Revision control metadata '));
    safe_push(table2,
              { 'revision control' : pm2_env.versioning.type },
              { 'remote url' : pm2_env.versioning.url },
              { 'repository root' : pm2_env.versioning.repo_path },
              { 'last update' : pm2_env.versioning.update_time },
              { 'revision' : pm2_env.versioning.revision },
              { 'comment' :  pm2_env.versioning.comment ? pm2_env.versioning.comment.trim().slice(0, 60) : '' },
              { 'branch' :  pm2_env.versioning.branch }
             );
    console.log(table2.toString());
  }

  if (pm2_env.axm_actions && Object.keys(pm2_env.axm_actions).length > 0) {
    var table_actions = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    });

    console.log(chalk.inverse.bold(' Actions available '));
    pm2_env.axm_actions.forEach(function(action_set) {
      safe_push(table_actions, [action_set.action_name]);
    });

    console.log(table_actions.toString());
    Common.printOut(chalk.white.italic(' Trigger via: pm2 trigger %s <action_name>\n'), pm2_env.name);
  }

  if (pm2_env.axm_monitor && Object.keys(pm2_env.axm_monitor).length > 0) {
    var table_probes = new Table({
      style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
    });

    console.log(chalk.inverse.bold(' Code metrics value '));
    Object.keys(pm2_env.axm_monitor).forEach(function(key) {
      var obj = {};
      var metric_name = pm2_env.axm_monitor[key].hasOwnProperty("value") ? pm2_env.axm_monitor[key].value : pm2_env.axm_monitor[key]
      var metric_unit = pm2_env.axm_monitor[key].hasOwnProperty("unit") ? pm2_env.axm_monitor[key].unit : ''
      var value = `${metric_name} ${metric_unit}`;
      obj[key] = value;
      safe_push(table_probes, obj);
    });

    console.log(table_probes.toString());
  }

  var table_env = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  console.log(chalk.inverse.bold(' Divergent env variables from local env '));

  var _env = Common.safeExtend({}, pm2_env)
  var diff_env = {}

  Object.keys(process.env).forEach(k => {
    if (!_env[k] || _env[k] != process.env[k]) {
      diff_env[k] = process.env[k]
    }
  })

  Object.keys(diff_env).forEach(function(key) {
    var obj = {};
    if (_env[key]) {
      obj[key] = _env[key].slice(0, process.stdout.columns - 60);
      safe_push(table_env, obj);
    }
  });

  console.log(table_env.toString());
  console.log()
  Common.printOut(chalk.white.italic(' Add your own code metrics: http://bit.ly/code-metrics'));
  Common.printOut(chalk.white.italic(' Use `pm2 logs %s [--lines 1000]` to display logs'), pm2_env.name);
  Common.printOut(chalk.white.italic(' Use `pm2 env %s` to display environment variables'), pm2_env.pm_id);
  Common.printOut(chalk.white.italic(' Use `pm2 monit` to monitor CPU and Memory usage'), pm2_env.name);
};

/**
 * Description
 * @method dispAsTable
 * @param {} list
 * @param {} commander
 * @return
 */
UX.dispAsTable = function(list, sys_infos) {
  var pm2_conf = Configuration.getSync('pm2')

  var condensed_mode = (process.stdout.columns || 300) < 120
  var app_head = {
    id: 4,
    name: 25,
    version: 9,
    mode: 9,
    pid: 10,
    uptime: 8,
    '↺': 6,
    status: 10,
    cpu: 10,
    mem: 10,
    user: 10,
    watching: 10
  }

  var mod_head = {
    id: 4,
    module: 39,
    version: 20,
    pid: 7,
    status: 10,
    '↺': 6,
    cpu: 10,
    mem: 10,
    user: 10
  }

  if (condensed_mode) {
    app_head = {
      id: 4,
      name: 20,
      mode: 10,
      '↺': 6,
      status: 10,
      cpu: 10,
      memory: 10
    }

    mod_head = {
      id: 4,
      name: 20,
      status: 10,
      cpu: 10,
      mem: 10
    }
  }

  var proc_id = 0

  var app_table = new Table({
    head : Object.keys(app_head),
    colWidths: Object.keys(app_head).map(k => app_head[k]),
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  var module_table = new Table({
    head : Object.keys(mod_head),
    colWidths: Object.keys(mod_head).map(k => mod_head[k]),
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'],  compact : true}
  });

  if (!list)
    return console.log('list empty');

  var sortField = 'name', sortOrder = 'asc', sort,
  fields = {
    name: 'pm2_env.name',
    pid: 'pid',
    id: 'pm_id',
    cpu: 'monit.cpu',
    memory: 'monit.memory',
    uptime: 'pm2_env.pm_uptime',
    status: 'pm2_env.status'
  };

  list.sort(function(a, b) {

    var fieldA = getNestedProperty(fields[sortField], a);
    var fieldB = getNestedProperty(fields[sortField], b);

    if(sortOrder === 'desc') {
      if (fieldA > fieldB)
        return -1;
      if (fieldA < fieldB)
        return 1;
    } else {
      if (fieldA < fieldB)
        return -1;
      if (fieldA > fieldB)
        return 1;
    }

    return 0;
  });

  list.forEach(function(l) {
    var obj = {};

    if (l.pm2_env.pm_id > proc_id) {
      proc_id = l.pm2_env.pm_id
    }

    var mode = l.pm2_env.exec_mode;
    var status = l.pm2_env.status;
    var key = l.pm2_env.pm_id
    key = chalk.bold.cyan(key);

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
      // pm2 ls for Modules
      obj[key] = [];

      obj[key].push(l.name)

      // Module version + PID
      if (!condensed_mode) {
        var pid = l.pm2_env.axm_options.pid ? l.pm2_env.axm_options.pid : l.pid
        obj[key].push(l.pm2_env.version || 'N/A', pid);
      }

      // Status
      obj[key].push(colorStatus(status));

      // Restart
      if (!condensed_mode)
        obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);

      // CPU + Memory
      obj[key].push(l.monit ? (l.monit.cpu + '%') : 'N/A', l.monit ? UX.bytesToSize(l.monit.memory, 1) : 'N/A' );

      // User
      if (!condensed_mode) {

        if (l.pm2_env.uid && typeof(l.pm2_env.uid) == 'number') {
          // Resolve user id to username
          let users = Passwd.getUsers()
          Object.keys(users).forEach(function(username) {
            var user = users[username]
            if (user.userId == l.pm2_env.uid) {
              l.pm2_env.uid = user.name
            }
          })
        }
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username));
      }

      safe_push(module_table, obj);
    }
    else {
      // pm2 ls for Applications
      obj[key] = [];

      // PM2 ID
      obj[key].push(l.pm2_env.name);

      // Version
      if (!condensed_mode)
        obj[key].push(l.pm2_env.version);

      // Exec mode
      obj[key].push(mode == 'fork_mode' ? chalk.inverse.bold('fork') : chalk.blue.bold('cluster'));

      // PID
      if (!condensed_mode)
        obj[key].push(l.pid);

      // Uptime
      if (!condensed_mode)
        obj[key].push((l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0);

      // Restart
      obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);

      // Status
      obj[key].push(colorStatus(status));


      // CPU
      obj[key].push(l.monit ? l.monit.cpu + '%' : 'N/A');

      // Memory
      obj[key].push(l.monit ? UX.bytesToSize(l.monit.memory, 1) : 'N/A');

      // User
      if (!condensed_mode) {
        if (l.pm2_env.uid && typeof(l.pm2_env.uid) == 'number') {
          // Resolve user id to username
          let users = Passwd.getUsers()
          Object.keys(users).forEach(function(username) {
            var user = users[username]
            if (user.userId == l.pm2_env.uid) {
              l.pm2_env.uid = user.name
            }
          })
        }
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username));
      }

      // Watch status
      if (!condensed_mode)
        obj[key].push(l.pm2_env.watch ? chalk.green.bold('enabled') : chalk.grey('disabled'));

      safe_push(app_table, obj);
    }

  });

  console.log(app_table.toString());

  proc_id++
  // Container display
  if (sys_infos && sys_infos.containers && sys_infos.containers.length > 0 &&
      (pm2_conf && pm2_conf.show_docker == "true")) {
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
    });

    sys_infos.containers.forEach((c) => {
      var cpu = c.stats.cpu_percent
      var mem = c.stats.mem_percent == 0 ? '0' : c.stats.mem_percent
      var id = chalk.bold.cyan(proc_id++)
      var state = colorStatus(c.state)

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
    console.log(docker_table.toString());
  }

  /**
   * High resource processes
   */
  if (sys_infos && sys_infos.processes) {
    const CPU_MIN_SHOW = 60
    const MEM_MIN_SHOW = 30

    var sys_proc_head = ['id', 'cmd', 'pid', 'cpu', 'mem', 'uid']

    var sys_proc_table = new Table({
      colWidths: [4, condensed_mode ? 29 : 77, 10, 10, 10, 8],
      head : sys_proc_head,
      colAligns : ['left'],
      style : {'padding-left' : 1, head : ['cyan', 'bold'],  compact : true}
    });

    if (sys_infos.processes.cpu_sorted || sys_infos.processes.mem_sorted) {
      sys_infos.processes.cpu_sorted = sys_infos.processes.cpu_sorted.filter((proc) => {
        return proc.cpu > CPU_MIN_SHOW && proc.cmd.includes('node') === false &&
          proc.cmd.includes('God Daemon') === false
      })
      sys_infos.processes.cpu_sorted.forEach(proc => {
        var cpu = `${colorizedMetric(proc.cpu, 40, 70, '%')}`
        var mem = `${colorizedMetric(proc.memory, 40, 70, '%')}`
        var cmd = proc.cmd
        // if (proc.cmd.length > 50)
        //   cmd = '…' + proc.cmd.slice(proc.cmd.length - 48, proc.cmd.length)
        sys_proc_table.push([chalk.bold.cyan(proc_id++), cmd, proc.pid, cpu, mem, proc.uid])
      })

      sys_infos.processes.mem_sorted = sys_infos.processes.mem_sorted.filter((proc) => {
        return proc.memory > MEM_MIN_SHOW && proc.cmd.includes('node') == false
      })
      sys_infos.processes.mem_sorted.forEach((proc) => {
        var cpu = `${colorizedMetric(proc.cpu, 40, 70, '%')}`
        var mem = `${colorizedMetric(proc.memory, 40, 70, '%')}`
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
  }

  /**
   * Modules Display
   */
  if (module_table.length > 0) {
    console.log(chalk.bold(`Module${module_table.length > 1 ? 's' : ''}`));
    console.log(module_table.toString());
  }

  /**
   * Sys info line
   */
  if (sys_infos && sys_infos.cpu && sys_infos.cpu.usage) {
    var sys_summary_line = `${chalk.bold.cyan('host metrics')} `
    sys_summary_line += `| ${chalk.bold('cpu')}: ${colorizedMetric(sys_infos.cpu.usage, 40, 70, '%')}`
    if (sys_infos.cpu.temperature && sys_infos.cpu.temperature != '-1') {
      sys_summary_line += ` ${colorizedMetric(sys_infos.cpu.temperature, 50, 70, 'º')}`
    }
    if (sys_infos.mem) {
      var perc_mem_usage = (((sys_infos.mem.available) / sys_infos.mem.total) * 100).toFixed(1)
      sys_summary_line += ` | ${chalk.bold('mem')}: ${colorizedMetric(perc_mem_usage, 80, 90, '%')} `
    }
    if (sys_infos.network) {
      var latency = (sys_infos.network.latency).toFixed(1)
      if (latency == -1) {
        sys_summary_line += `| ${chalk.bold('net')}: ${chalk.red('offline')} `
      }
      else {
        sys_summary_line += `| ${chalk.bold('net')}: `
        //sys_summary_line += `${colorizedMetric(latency, 100, 150, 'ms')} `
        sys_summary_line += `⇓ ${colorizedMetric(sys_infos.network.rx_5, 10, 20, 'mb/s')} `
        sys_summary_line += `⇑ ${colorizedMetric(sys_infos.network.tx_5, 10, 20, 'mb/s')} `
      }
    }
    if (condensed_mode == false) {
      if (sys_infos.storage) {
        sys_summary_line += `| ${chalk.bold('disk')}: ⇓ ${colorizedMetric(sys_infos.storage.io.read, 10, 20, 'mb/s')}`
        sys_summary_line += ` ⇑ ${colorizedMetric(sys_infos.storage.io.write, 10, 20, 'mb/s')} `
      }
      var disk_nb = 0

      sys_infos.storage.filesystems.forEach(fs => {
        disk_nb++
        var perc_used = ((fs.used / fs.size) * 100).toFixed()
        if (perc_used > 60)
          sys_summary_line += `${chalk.grey(fs.fs)} ${colorizedMetric(perc_used, 80, 90, '%')} `
      })
    }

    sys_summary_line += '|'
    console.log(sys_summary_line)
  }
};

UX.openEditor = function (file, opts, cb) {
  var spawn = require('child_process').spawn;

  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  if (!opts) opts = {};

  var ed = /^win/.test(process.platform) ? 'notepad' : 'vim';
  var editor = opts.editor || process.env.VISUAL || process.env.EDITOR || ed;
  var args = editor.split(/\s+/);
  var bin = args.shift();

  var ps = spawn(bin, args.concat([ file ]), { stdio: 'inherit' });

  ps.on('exit', function (code, sig) {
    if (typeof cb === 'function') cb(code, sig)
  });
};

UX.dispKeys = function(kv, target_module) {
  Object.keys(kv).forEach(function(key) {

    if (target_module != null && target_module != key)
      return false;

    if (typeof(kv[key]) == 'object') {
      var obj = {};

      console.log(chalk.bold('Module: ') + chalk.bold.blue(key));
      Object.keys(kv[key]).forEach(function(sub_key) {
        console.log(`$ pm2 set ${key}:${sub_key} ${kv[key][sub_key]}`);
      });
    }
  })
}

UX.processing = {
  current_spinner : null,
  start : function(text) {
    this.current_spinner = new Spinner(text || 'Connecting...');
    this.current_spinner.start();
  },
  stop : function() {
    if (!this.current_spinner) return;
    this.current_spinner.stop();
    this.current_spinner = null;
  }
};


/**
 * Description
 * @method bytesToSize
 * @param {} bytes
 * @param {} precision
 * @return
 */
UX.bytesToSize = function(bytes, precision) {
  var kilobyte = 1024;
  var megabyte = kilobyte * 1024;
  var gigabyte = megabyte * 1024;
  var terabyte = gigabyte * 1024;

  if ((bytes >= 0) && (bytes < kilobyte)) {
    return bytes + 'b ';
  } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
    return (bytes / kilobyte).toFixed(precision) + 'kb ';
  } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
    return (bytes / megabyte).toFixed(precision) + 'mb ';
  } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
    return (bytes / gigabyte).toFixed(precision) + 'gb ';
  } else if (bytes >= terabyte) {
    return (bytes / terabyte).toFixed(precision) + 'tb ';
  } else {
    return bytes + 'b ';
  }
};

/**
 * Description
 * @method colorStatus
 * @param {} status
 * @return
 */
function colorStatus(status) {
  switch (status) {

  case 'online':
    return chalk.green.bold('online');
    break;
  case 'running':
    return chalk.green.bold('online');
    break;
  case 'restarting':
    return chalk.yellow.bold('restart');
    break;
  case 'created':
    return chalk.yellow.bold('created');
    break;
  case 'launching':
    return chalk.blue.bold('launching');
    break;
  default:
    return chalk.red.bold(status);
  }
}

var safe_push = function() {
  var argv = arguments;
  var table = argv[0];

  for (var i = 1; i < argv.length; ++i) {
    var elem = argv[i];
    if (elem[Object.keys(elem)[0]] === undefined
        || elem[Object.keys(elem)[0]] === null) {
      elem[Object.keys(elem)[0]] = 'N/A';
    }
    else if (Array.isArray(elem[Object.keys(elem)[0]])) {
      elem[Object.keys(elem)[0]].forEach(function(curr, j) {
        if (curr === undefined || curr === null)
          elem[Object.keys(elem)[0]][j] = 'N/A';
      });
    }
    table.push(elem);
  }
};

/**
 * Description
 * @method timeSince
 * @param {} date
 * @return BinaryExpression
 */
function timeSince(date) {

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = Math.floor(seconds / 31536000);

  if (interval > 1) {
    return interval + 'Y';
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + 'M';
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + 'D';
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + 'h';
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + 'm';
  }
  return Math.floor(seconds) + 's';
}

function colorizedMetric(value, warn, alert, prefix) {
  if (!prefix) prefix = ''
  if (isNaN(value) === true)
    return 'N/A'
  if (value == 0)
    return 0 + prefix
  if (value < warn)
    return chalk.green(value + prefix)
  if (value >= warn && value <= alert)
    return chalk.bold.yellow(value + prefix)
  return chalk.bold.red(value + prefix)
}
/**
 * Get nested property
 *
 * @param {String} propertyName
 * @param {Object} obj
 * @returns {String} property value
 */
function getNestedProperty(propertyName, obj) {
  var parts = propertyName.split('.'),
    length = parts.length,
    property = obj || {};

  for ( var i = 0; i < length; i++ ) {
    property = property[parts[i]];
  }

  return property;
}
