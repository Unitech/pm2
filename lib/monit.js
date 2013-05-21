
var multimeter = require('multimeter');

var bars = {};

var Monit = module.exports = {};

Monit.init = function(processes) {
  if (processes === undefined) throw new Error('No processes passed to init');
  Monit.multi = multimeter(process);

  Monit.multi.on('^C', process.exit);
  Monit.multi.charm.reset();

  Monit.multi.write('PM2 monitoring :\n\n');

  processes.forEach(function(proc, i) {
    if (proc.status == 'stopped') return ;
    Monit.multi.write(proc.opts.script + ' [' + proc.pid + '] ' + ' \n\n');

    var bar_cpu = Monit.multi(40, (i * 2) + 3 + i, {
      width: 30,
      solid: {
        text: '|',
        foreground: 'white',
        background: 'blue'
      },
      empty: {
        text: ' '
      }
    });

    var bar_memory = Monit.multi(40, (i * 2) + 4 + i, {
      width: 30,
      solid: {
        text: '|',
        foreground: 'white',
        background: 'red'
      },
      empty: {
        text: ' '
      }
    });

    bar_cpu.percent(proc.monit.cpu);
    bar_memory.ratio(proc.monit.memory,
		     200000000,
		     bytesToSize(proc.monit.memory, 3));
    bars[proc.pid] = {};
    bars[proc.pid].memory = bar_memory;
    bars[proc.pid].cpu = bar_cpu;
    Monit.multi.write('\n');
  });
}

Monit.refresh = function(dt) {
  if (Object.keys(bars).length == 0) {
    Monit.multi.write('No online process to monitor\n');
    process.exit(1);
  }
  dt.forEach(function(proc, i) {
    if (proc && proc.monit && bars[proc.pid]) {

      bars[proc.pid].cpu.percent(proc.monit.cpu);
      bars[proc.pid].memory.ratio(proc.monit.memory,
				  200000000,
				  bytesToSize(proc.monit.memory, 3));
    }
  });
}

function bytesToSize(bytes, precision) {
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
}
