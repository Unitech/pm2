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
var os = require('os');
var UX = module.exports = {};

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
    console.log('pid : %s', l.pid);
    console.log('pm2 id : %s', l.pm2_env.pm_id);
    console.log('status : %s', status);
    console.log('mode : %s', mode);
    console.log('restarted : %d', l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);
    console.log('uptime : %s', (l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0);
    console.log('memory usage : %s', l.monit ? UX.bytesToSize(l.monit.memory, 3) : '');
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
UX.describeTable = function(process) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  var pm2_env = process.pm2_env;

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

  if('pm_log_path' in pm2_env){
    table.splice(6, 0, {'entire log path': pm2_env.pm_log_path});
  }

  console.log(table.toString());

  /**
   * Module conf display
   */
  if (pm2_env.axm_options && pm2_env.axm_options.module_conf && Object.keys(pm2_env.axm_options.module_conf).length > 0) {
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
              { 'comment' :  pm2_env.versioning.comment },
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
      var value = pm2_env.axm_monitor[key].hasOwnProperty("value") ? pm2_env.axm_monitor[key].value : pm2_env.axm_monitor[key];
      obj[key] = value;
      safe_push(table_probes, obj);
    });

    console.log(table_probes.toString());
  }

  Common.printOut(chalk.white.italic(' Add your own code metrics: http://bit.ly/code-metrics'));
  Common.printOut(chalk.white.italic(' Use `pm2 logs %s [--lines 1000]` to display logs'), pm2_env.name);
  Common.printOut(chalk.white.italic(' Use `pm2 monit` to monitor CPU and Memory usage'), pm2_env.name);
};

/**
 * Description
 * @method dispAsTable
 * @param {} list
 * @param {} commander
 * @return
 */
UX.dispAsTable = function(list, commander) {
  var stacked = (process.stdout.columns || 90) < 90;
  var app_head = stacked ? ['Name', 'mode', 'status', '↺', 'cpu', 'memory'] :
        ['App name', 'id', 'mode', 'pid', 'status', 'restart', 'uptime', 'cpu', 'mem', 'user', 'watching'];
  var mod_head = stacked ? ['Module', 'status', 'cpu', 'mem'] :
        ['Module', 'version', 'target PID',  'status', 'restart', 'cpu', 'memory', 'user'];

  var app_table = new Table({
    head : app_head,
    colAligns : ['left'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
  });

  var module_table = new Table({
    head : mod_head,
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

  if(commander && commander.sort) {
    sort = commander.sort.split(':');

    if(fields[sort[0].toLowerCase()]) {
      sortField = sort[0].toLowerCase();
      sortOrder = sort.length === 2 ? sort[1] : 'asc';
    }
  }

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

    var mode = l.pm2_env.exec_mode;
    var status = l.pm2_env.status;
    var key = l.pm2_env.name || p.basename(l.pm2_env.pm_exec_path.script);
    key = chalk.bold.cyan(key);

    if (l.pm2_env.axm_options) {
      var deep_monitored = l.pm2_env.axm_options.tracing_enabled || false;
      if (deep_monitored == true) {
        key = chalk.green('✚')  + '  ' + key;
      }
    }

    if (l.pm2_env.pmx_module == true) {
      // pm2 ls for Modules
      obj[key] = [];

      // Module version + PID
      if (!stacked)
        obj[key].push(chalk.bold(l.pm2_env.axm_options.module_version || 'N/A'), typeof(l.pm2_env.axm_options.pid) === 'number' ? l.pm2_env.axm_options.pid : 'N/A' );

      // Status
      obj[key].push(colorStatus(status));

      // Restart
      if (!stacked)
        obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);

      // CPU + Memory
      obj[key].push(l.monit ? (l.monit.cpu + '%') : 'N/A', l.monit ? UX.bytesToSize(l.monit.memory, 3) : 'N/A' );

      // User
      if (!stacked)
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username));

      safe_push(module_table, obj);
    }
    else {
      // pm2 ls for Applications
      obj[key] = [];

      // PM2 ID
      if (!stacked)
        obj[key].push(l.pm2_env.pm_id);

      // Exec mode
      obj[key].push(mode == 'fork_mode' ? chalk.inverse.bold('fork') : chalk.blue.bold('cluster'));

      // PID
      if (!stacked)
        obj[key].push(l.pid);

      // Status
      obj[key].push(colorStatus(status));

      // Restart
      obj[key].push(l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);

      // Uptime
      if (!stacked)
        obj[key].push((l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0);

      // CPU
      obj[key].push(l.monit ? l.monit.cpu + '%' : 'N/A');

      // Memory
      obj[key].push(l.monit ? UX.bytesToSize(l.monit.memory, 1) : 'N/A');

      // User
      if (!stacked)
        obj[key].push(chalk.bold(l.pm2_env.uid || l.pm2_env.username));

      // Watch status
      if (!stacked)
        obj[key].push(l.pm2_env.watch ? chalk.green.bold('enabled') : chalk.grey('disabled'));

      safe_push(app_table, obj);
    }

  });

  console.log(app_table.toString());
  if (module_table.length > 0) {
    console.log(chalk.bold(' Module activated'));
    console.log(module_table.toString());
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
      var app_table = new Table({
        head:       ['key', 'value'],
        colAligns : ['left', 'left'],
        style : {'padding-left' : 1, head : ['cyan', 'bold'], compact : true}
      });

      var obj = {};

      Object.keys(kv[key]).forEach(function(sub_key) {
        app_table.push([sub_key, kv[key][sub_key]]);
      });

      console.log('== ' + chalk.bold.blue(key) + ' ==');
      console.log(app_table.toString());
    }
  });
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
    return bytes + ' B   ';
  } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
    return (bytes / kilobyte).toFixed(precision) + ' KB  ';
  } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
    return (bytes / megabyte).toFixed(precision) + ' MB  ';
  } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
    return (bytes / gigabyte).toFixed(precision) + ' GB  ';
  } else if (bytes >= terabyte) {
    return (bytes / terabyte).toFixed(precision) + ' TB  ';
  } else {
    return bytes + ' B   ';
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

  for ( i = 0; i < length; i++ ) {
    property = property[parts[i]];
  }

  return property;
}
