var Table   = require('cli-table');
var p       = require('path');
var UX      = module.exports = {};

var chalk = require('chalk');

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
    var port = l.pm2_env.port;
    var key = l.pm2_env.name || p.basename(l.pm2_env.pm_exec_path.script);

    console.log('+--- %s', key);
    console.log('pid : %s', l.pid);
    console.log('pm2 id : %s', l.pm2_env.pm_id);
    console.log('status : %s', status);
    console.log('mode : %s', mode);
    console.log('port : %s', port);
    console.log('restarted : %d', l.pm2_env.restart_time ? l.pm2_env.restart_time : 0);
    console.log('uptime : %s', (l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0);
    console.log('memory usage : %s', l.monit ? UX.bytesToSize(l.monit.memory, 3) : '');
    console.log('out log : %s', l.pm2_env.pm_out_log_path);
    console.log('error log : %s', l.pm2_env.pm_err_log_path);
    console.log('watching : %s', l.pm2_env.watch ? 'yes' : 'no');
    console.log('PID file : %s\n', [l.pm2_env.pm_pid_path, l.pm_id, '.pid'].join(''));
  });

};

/**
 * Description
 * @method describeTable
 * @param {} process
 * @return
 */
UX.describeTable = function(process) {
  var table = new Table({
    style : {'padding-left' : 1, head : ['cyan', 'bold'], border : ['white'], compact : true}
  });
  var pm2_env = process.pm2_env;

  var created_at = 'N/A';

  try {
    if(pm2_env.created_at != null)
      created_at = new Date(pm2_env.created_at).toISOString();
  } catch (e) {
    throw new Error(pm2_env.created_at + ' is not a valid date: '+e.message, e.fileName, e.lineNumber);
  }

  console.log('Describing process with pid %d - name %s', pm2_env.pm_id, pm2_env.name);
  table.push(
    { 'status' : colorStatus(pm2_env.status) },
    { 'name': pm2_env.name },
    { 'id' : pm2_env.pm_id },
    { 'path' : pm2_env.pm_exec_path },
    { 'args' : pm2_env.args ? JSON.parse(pm2_env.args.replace(/'/g, '"')).join(' ') : '' },
    { 'exec cwd' : pm2_env.pm_cwd },
    { 'error log path' : pm2_env.pm_err_log_path },
    { 'out log path' : pm2_env.pm_out_log_path },
    { 'pid path' : pm2_env.pm_pid_path },
    { 'mode' : pm2_env.exec_mode },
    { 'node v8 arguments' : pm2_env.node_args.length != 0 ? pm2_env.node_args : '' },
    { 'watch & reload' : pm2_env.watch ? chalk.green.bold('✔') : '✘' },
    { 'interpreter' : pm2_env.exec_interpreter },
    { 'restarts' : pm2_env.restart_time },
    { 'unstable restarts' : pm2_env.unstable_restarts },
    { 'uptime' : (pm2_env.pm_uptime && pm2_env.status == 'online') ? timeSince(pm2_env.pm_uptime) : 0 },
    { 'created at' : created_at }
  );

  console.log(table.toString());
};

/**
 * Description
 * @method dispAsTable
 * @param {} list
 * @param {} interact_infos
 * @return
 */
UX.dispAsTable = function(list, interact_infos) {
  var table = new Table({
    head:       ['App name', 'id',   'mode', 'PID',  'status', 'restarted', 'uptime', 'memory', 'watching'],
    colAligns : ['left',     'left', 'left', 'left', 'left'  , 'right',     'left',   'right',  'right'],
    style : {'padding-left' : 1, head : ['cyan', 'bold'], border : ['white'], compact : true}
  });

  if (!list)
    return console.log('list empty');
  list.forEach(function(l) {
    var obj = {};

    var mode = l.pm2_env.exec_mode.split('_mode')[0];
    var status = l.pm2_env.status;
    var port = l.pm2_env.port;
    var key = l.pm2_env.name.bold || p.basename(l.pm2_env.pm_exec_path.script).bold;

    obj[key] = [
      l.pm2_env.pm_id,
      mode == 'fork' ? chalk.inverse.bold('fork') : chalk.blue.bold('cluster'),
      l.pid,
      colorStatus(status),
      l.pm2_env.restart_time ? l.pm2_env.restart_time : 0,
      (l.pm2_env.pm_uptime && status == 'online') ? timeSince(l.pm2_env.pm_uptime) : 0,
      l.monit ? UX.bytesToSize(l.monit.memory, 3) : '',
      l.pm2_env.watch ? chalk.green.bold('activated') : chalk.grey('unactivated')
    ];

    table.push(obj);
  });

  console.log(table.toString());
};

UX.processing = {
  /**
   * Description
   * @method start
   * @return
   */
  start : function() {
    console.log('Processing......');
  },
  /**
   * Description
   * @method stop
   * @return
   */
  stop : function() {
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
