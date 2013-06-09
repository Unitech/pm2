
var multimeter = require('multimeter');

var bars = {};

var Monit = module.exports = {};

const RATIO = 300000000;

Monit.init = function(processes) {
  if (processes === undefined || processes[0] == null)
    throw new Error('No processes passed to init');

  if (processes[0].monit == null || processes[0].monit == undefined)
    throw new Error('You seems to run on a Mac OS, node-usage can\'t get monitor data');
  
  Monit.multi = multimeter(process);

  Monit.multi.on('^C', process.exit);
  Monit.multi.charm.reset();

  Monit.multi.write('\x1B[32m⌬ PM2 \x1B[39mmonitoring :\n\n');

  processes.forEach(function(proc, i) {
    if (proc.status == 'stopped' || proc.status == 'stopped - too fast exit')
      return ;
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
		     RATIO,
		     bytesToSize(proc.monit.memory, 3));
    bars[proc.pid] = {};
    bars[proc.pid].memory = bar_memory;
    bars[proc.pid].cpu = bar_cpu;
    Monit.multi.write('\n');
  });
};

Monit.refresh = function(dt) {
  dt.forEach(function(proc, i) {
    if (proc && proc.monit && bars[proc.pid]) {
      
      bars[proc.pid].cpu.percent(proc.monit.cpu);
      bars[proc.pid].memory.ratio(proc.monit.memory,
				  RATIO,
				  bytesToSize(proc.monit.memory, 3));
    }
  });
};

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
