/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
// pm2-htop
// Library who interacts with PM2 to display processes resources in htop way
// by Strzelewicz Alexandre

var multimeter = require('pm2-multimeter');
var os         = require('os');
var p          = require('path');
var chalk      = require('chalk');

var UX      = require('./UX');

var debug = require('debug')('pm2:monit');

// Cst for light programs
const RATIO_T1   = Math.floor(os.totalmem() / 500);
// Cst for medium programs
const RATIO_T2   = Math.floor(os.totalmem() / 50);
// Cst for heavy programs
const RATIO_T3   = Math.floor(os.totalmem() / 5);
// Cst for heavy programs
const RATIO_T4   = Math.floor(os.totalmem());

var Monit = {};

//helper to get bars.length (num bars printed)
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

/**
 * Reset the monitor through charm, basically \033c
 * @param  String msg optional message to show
 * @return Monit
 */
Monit.reset = function(msg) {

  this.multi.charm.reset();

  this.multi.write('\x1B[32m⌬ PM2 \x1B[39mmonitoring\x1B[96m (To go further check out https://app.pm2.io) \x1B[39m\n\n');

  if(msg) {
    this.multi.write(msg);
  }

  this.bars = {};

  return this;
}

/**
 * Synchronous Monitor init method
 * @method init
 * @return Monit
 */
Monit.init = function() {

  this.multi = multimeter(process);

  this.multi.on('^C', this.stop);

  this.reset();

  return this;
}

/**
 * Stops monitor
 * @method stop
 */
Monit.stop = function() {
  this.multi.charm.destroy();
  process.exit(0);
}


/**
 * Refresh monitor
 * @method refresh
 * @param {} processes
 * @return this
 */
Monit.refresh = function(processes) {
  debug('Monit refresh');

  if(!processes) {
    processes = [];
  }

  var num = processes.length;
  this.num_bars = Object.size(this.bars);

  if(num !== this.num_bars) {
    debug('Monit addProcesses - actual: %s, new: %s', this.num_bars, num);
    return this.addProcesses(processes);
  } else {

    if(num === 0) {
      return;
    }

    debug('Monit refresh');
    var proc;

    for(var i = 0; i < num; i++) {
      proc = processes[i];

      //this is to avoid a print issue when the process is restarted for example
      //we might also check for the pid but restarted|restarting will be rendered bad
      if(this.bars[proc.pm_id] && proc.pm2_env.status !== this.bars[proc.pm_id].status) {
        debug('bars for %s does not exist', proc.pm_id);
        this.addProcesses(processes);
        break;
      }

      this.updateBars(proc);

    }
  }

  return this;
}

Monit.addProcess = function(proc, i) {
  if(proc.pm_id in this.bars) {
    return ;
  }

  if (proc.monit.error)
    throw new Error(JSON.stringify(proc.monit.error));

  var process_name = proc.pm2_env.name || p.basename(proc.pm2_env.pm_exec_path);
  var status = proc.pm2_env.status == 'online' ? chalk.green.bold('●') : chalk.red.bold('●');

  this.multi.write(' ' + status + ' ' + chalk.green.bold(process_name));
  this.multi.write('\n');
  this.multi.write('[' + proc.pm2_env.pm_id + '] [' + proc.pm2_env.exec_mode + ']\n');

  var bar_cpu = this.multi(40, (i * 2) + 3 + i, {
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

  var bar_memory = this.multi(40, (i * 2) + 4 + i, {
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

  this.bars[proc.pm_id] = {
    memory: bar_memory,
    cpu: bar_cpu,
    status: proc.pm2_env.status
  };

  this.updateBars(proc);

  this.multi.write('\n');

  return this;
}

Monit.addProcesses = function(processes) {

  if(!processes) {
    processes = [];
  }

  this.reset();

  var num = processes.length;

  if(num > 0) {
    for(var i = 0; i < num; i++) {
      this.addProcess(processes[i], i);
    }
  } else {
    this.reset('No processes to monit');
  }

}

// Draw memory bars
/**
 * Description
 * @method drawRatio
 * @param {} bar_memory
 * @param {} memory
 * @return
 */
Monit.drawRatio = function(bar_memory, memory) {
  var scale = 0;

  if (memory < RATIO_T1) scale = RATIO_T1;
  else if (memory < RATIO_T2) scale = RATIO_T2;
  else if (memory < RATIO_T3) scale = RATIO_T3;
  else scale = RATIO_T4;

  bar_memory.ratio(memory,
		   scale,
		   UX.helpers.bytesToSize(memory, 3));
};

/**
 * Updates bars informations
 * @param  {} proc       proc object
 * @return  this
 */
Monit.updateBars = function(proc) {
  if (this.bars[proc.pm_id]) {
    if (proc.pm2_env.status !== 'online' || proc.pm2_env.status !== this.bars[proc.pm_id].status) {
      this.bars[proc.pm_id].cpu.percent(0, chalk.red(proc.pm2_env.status));
      this.drawRatio(this.bars[proc.pm_id].memory, 0, chalk.red(proc.pm2_env.status));
    } else if (!proc.monit) {
      this.bars[proc.pm_id].cpu.percent(0, chalk.red('No data'));
      this.drawRatio(this.bars[proc.pm_id].memory, 0, chalk.red('No data'));
    } else {
      this.bars[proc.pm_id].cpu.percent(proc.monit.cpu);
      this.drawRatio(this.bars[proc.pm_id].memory, proc.monit.memory);
    }
  }

  return this;
}

module.exports = Monit;
