/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
// pm2-htop
// Library who interacts with PM2 to display processes resources in htop way
// by Strzelewicz Alexandre

var os         = require('os');
var p          = require('path');
var blessed    = require('blessed');
var fs         = require('fs');

var debug = require('debug')('pm2:monit');

// Total memory
const totalMem = os.totalmem();
// Cst for light programs
const RATIO_T1   = Math.floor(totalMem / 500);
// Cst for medium programs
const RATIO_T2   = Math.floor(totalMem / 50);
// Cst for heavy programs
const RATIO_T3   = Math.floor(totalMem / 5);
// Cst for heavy programs
const RATIO_T4   = Math.floor(totalMem);

var Monit = {};

/**
 * Synchronous Monitor init method
 * @method init
 * @return Monit
 */
Monit.init = function() {
  this.screen = blessed.screen({
    smartCSR: true
  });
  this.screen.title = 'PM2 Monitor';

  this.list = blessed.list({
    top: '0',
    left: '0',
    width: '60%',
    height: '70%',
    scrollbar: {
      ch: ' ',
      inverse: false
    },
    border: {
      type: 'line'
    },
    keys: true,
    autoCommandKeys: true,
    tags: true,
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      },
      scrollbar: {
        bg: 'blue',
        fg: 'black'
      },
      fg: 'white',
      border: {
        fg: '#f0f0f0'
      }
    }
  });
  this.box1 = blessed.box({
    top: '70%',
    left: '0%',
    width: '60%',
    height: '30%',
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: '#f0f0f0'
      }
    }
  });
  this.box2 = blessed.box({
    top: '0%',
    left: '60%',
    width: '40%',
    height: '70%',
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: '#f0f0f0'
      }
    }
  });
  this.box3 = blessed.box({
    top: '70%',
    left: '60%',
    width: '40%',
    height: '30%',
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: '#f0f0f0'
      }
    }
  });
  this.memBar = blessed.ProgressBar({
    parent: this.box2,
    top: '15%',
    left: '65%',
    orientation: 'vertical',
    width: '10%',
    height: '50%',
    barBg: 'green',
    value: 0
  });
  this.cpuBar = blessed.ProgressBar({
    parent: this.box2,
    top: '15%',
    left: '85%',
    orientation: 'vertical',
    width: '10%',
    height: '50%',
    barBg: 'red',
    value: 0
  });   

  this.list.focus();

  this.screen.append(this.list);
  this.screen.append(this.box1);
  this.screen.append(this.box2);
  this.screen.append(this.box3);
  this.screen.append(this.memBar);
  this.screen.append(this.cpuBar);
  this.screen.render();

  this.screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    this.screen.destroy();
    process.exit(0);
  });

  this.screen.key(['C-r', 'Cmd-r'], function(ch, key) {
  });

  return this;
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
    this.list.setLine(0, 'No process available');
    this.screen.render();
    return;
  }

  this.box3.setLine(0, '{center}{bold}Server{/bold}{/center}');

  this.box3.setLine(2, 'CPU{|}' + String(Math.floor(os.loadavg()[0] * 100 / os.cpus().length)) + ' % ');
  this.box3.setLine(3, 'Memory{|}' + String(((totalMem - os.freemem()) / 1000000).toFixed(2)) + ' MB');

  if (processes.length != this.list.items.length) {
    this.list.clearItems();
  }

  var mem = 0;
  processes.forEach(function(proc) {
    mem += proc.monit.memory;
  })

  for (var i = 0; i < processes.length; i++) {
    var memory = processes[this.list.selected].monit.memory;

    if (memory < RATIO_T1) scale = RATIO_T1;
    else if (memory < RATIO_T2) scale = RATIO_T2;
    else if (memory < RATIO_T3) scale = RATIO_T3;
    else scale = RATIO_T4;

    // var memPercent = Math.log(memory + 1) * (100 / Math.log(totalMem));
    var memPercent = (memory / mem) * 100;

    var status = processes[i].pm2_env.status == 'online' ? '{green-fg}' : '{red-fg}';
    status = status + '{bold}' + processes[i].pm2_env.status + '{/}';

    var name = processes[i].pm2_env.name || p.basename(processes[i].pm2_env.pm_exec_path);
    var item = status + ' - ' + name + '{|} [' + processes[i].pm2_env.pm_id + '] ' + processes[i].pm2_env.exec_mode;
    if (this.list.getItem(i)) {
      this.list.setItem(i, item);
    }
    else {
      this.list.pushItem(item);
    }

    if (this.list.selected >= 0) {
      this.box2.setLine(0, '{green-fg}MEM{/green-fg}{|}' + String((processes[this.list.selected].monit.memory / 1000000).toFixed(2)) + ' MB');
      this.box2.setLine(1, '{red-fg}CPU{/red-fg}{|}' + String(processes[this.list.selected].monit.cpu) + ' % ');
    }

    this.memBar.setProgress(memPercent);
    this.cpuBar.setProgress(processes[this.list.selected].monit.cpu);
    this.screen.render();
  }

  return this;
}

module.exports = Monit;
