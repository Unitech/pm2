
var Table = require('cli-table');

var sprintf = require('util').format;
var p = require('path');
var UX = module.exports = {};

UX.dispAsTable = function(list) {
  var table = new Table({
    head: ["Script/Name", "id", "PID","status", "Restarted", "Last restart", "memory", "err logs"],
    colAligns : ['left', 'left', 'left', 'left', 'left', 'left', 'right']
  });
  
  list.forEach(function(l) {
    var obj = {};

    var key = l.pm2_env.name || p.basename(l.pm2_env.pm_exec_path.script);
    obj[key] = [
      l.pm_id,
      l.pid,
      l.pm2_env.status,
      l.pm2_env.restart_time ? l.pm2_env.restart_time : 0,
      l.pm2_env.pm_uptime ? new Date(l.pm2_env.pm_uptime).toISOString().replace(/T/, ' ').replace(/\..+/, '') : 0,
      l.monit ? UX.bytesToSize(l.monit.memory, 3) : '',
      l.pm2_env.pm_err_log_path
    ];

    table.push(obj);
  });

  console.log(table.toString());
}

var timer;

UX.processing = {
  start : function() {
    // Code grabbed from Mocha by Visionmedia/Tj
    // https://github.com/visionmedia/mocha/blob/master/bin/_mocha

    var spinner = 'win32' == process.platform
                ? ['|','/','-','\\']
                : ['◜','◠','◝','◞','◡','◟'];

    function play(arr, interval) {
      var len = arr.length
        , interval = interval || 100
        , i = 0;

      timer = setInterval(function(){
                     var str = arr[i++ % len];
                     process.stdout.write('\u001b[0G' + str);
                   }, interval);
    }

    var frames = spinner.map(function(c) {
                   return sprintf('  \u001b[96m%s \u001b[90mProcessing...\u001b[0m', c);
                 });

    play(frames, 70);
  },
  stop : function() {
    process.stdout.write('\u001b[2K');
    clearInterval(timer);
  }
};

UX.bytesToSize = function(bytes, precision) {
  var kilobyte = 1024;
  var megabyte = kilobyte * 1024;
  var gigabyte = megabyte * 1024;
  var terabyte = gigabyte * 1024;

  if ((bytes >= 0) && (bytes < kilobyte)) {
    return bytes + ' B';
  } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
    return (bytes / kilobyte).toFixed(precision) + ' KB';
  } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
    return (bytes / megabyte).toFixed(precision) + ' MB';
  } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
    return (bytes / gigabyte).toFixed(precision) + ' GB';
  } else if (bytes >= terabyte) {
    return (bytes / terabyte).toFixed(precision) + ' TB';
  } else {
    return bytes + ' B';
  }
};

