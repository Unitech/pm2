// pm2-htop
// Library who interacts with PM2 to display processes resources in htop way
// by Strzelewicz Alexandre

var multimeter = require('pm2-multimeter');
var os         = require('os');
var CliUx      = require('./CliUx');
var bars       = {};
var path       = require('path');
var p          = path;
require('colors');

// Cst for light programs
const RATIO_T1   = Math.floor(os.totalmem() / 500);
// Cst for medium programs
const RATIO_T2   = Math.floor(os.totalmem() / 50);
// Cst for heavy programs
const RATIO_T3   = Math.floor(os.totalmem() / 5);
// Cst for heavy programs
const RATIO_T4   = Math.floor(os.totalmem());


var Monit        = module.exports = {};

Monit.init = function(processes, debug) {
  if (processes === undefined || processes[0] == null)
    throw new Error('No processes passed to init');

  if (!processes[0].monit)
    throw new Error('No monit assigned to processes');

  if (processes[0].monit.error)
    throw new Error(JSON.stringify(processes[0].monit.error));

  Monit.multi = multimeter(process);

  Monit.multi.on('^C', process.exit);
  Monit.multi.charm.reset();

  Monit.multi.write('\x1B[32m⌬ PM2 \x1B[39mmonitoring :\n\n');

  processes.forEach(function(proc, i) {
    if (proc.status == 'stopped' || proc.status == 'stopped - too fast exit')
      return ;

    var process_name = proc.pm2_env.name || p.basename(proc.pm2_env.pm_exec_path);
    var status = proc.pm2_env.status == 'online' ? '●'.green.bold : '●'.red.bold;

    Monit.multi.write(' ' + status + ' ' + process_name.green.bold);
    Monit.multi.write('\n');
    Monit.multi.write('[' + proc.pm2_env.pm_id + '] [' + proc.pm2_env.exec_mode + ']\n');

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
    Monit.drawRatio(bar_memory, proc.monit.memory);

    bars[proc.pid] = {};
    bars[proc.pid].memory = bar_memory;
    bars[proc.pid].cpu = bar_cpu;
    Monit.multi.write('\n');
  });
};

Monit.stop = function() {
  Monit.multi.charm.destroy();
};

// Draw memory bars
Monit.drawRatio = function(bar_memory, memory) {
  var scale = 0;

  if (memory < RATIO_T1) scale = RATIO_T1;
  else if (memory < RATIO_T2) scale = RATIO_T2;
  else if (memory < RATIO_T3) scale = RATIO_T3;
  else scale = RATIO_T4;

  bar_memory.ratio(memory,
		   scale,
		   CliUx.bytesToSize(memory, 3));
};

Monit.refresh = function(dt) {
  dt.forEach(function(proc, i) {
    if (proc && proc.monit && bars[proc.pid]) {

      bars[proc.pid].cpu.percent(proc.monit.cpu);
      Monit.drawRatio(bars[proc.pid].memory, proc.monit.memory);

    }
  });
};

