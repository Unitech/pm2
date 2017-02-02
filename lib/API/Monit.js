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
    width: '45%',
    height: '70%',
    noCellBorders: true,
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
        fg: 'blue'
      },
      header: {
        fg: 'blue'
      }
    }
  });
  this.box1 = blessed.box({
    label: ' Logs ',
    top: '0%',
    left: '45%',
    width: '55%',
    height: '70%',
    scrollable: true,
    scrollbar: {
      ch: ' ',
      inverse: false
    },
    keys: true,
    autoCommandKeys: true,
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: 'white'
      },
      scrollbar: {
        bg: 'blue',
        fg: 'black'
      }
    }
  });
  this.box2 = blessed.box({
    label: ' Metadata ',
    top: '70%',
    left: '0%',
    width: '70%',
    height: '24%',
    scrollable: true,
    scrollbar: {
      ch: ' ',
      inverse: false
    },
    keys: true,
    autoCommandKeys: true,
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: 'white'
      },
      scrollbar: {
        bg: 'blue',
        fg: 'black'
      }
    }
  });
  this.box3 = blessed.box({
    label: ' Code metrics ',
    top: '70%',
    left: '70%',
    width: '30%',
    height: '24%',
    scrollable: true,
    scrollbar: {
      ch: ' ',
      inverse: false
    },
    keys: true,
    autoCommandKeys: true,
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: 'white'
      },
      scrollbar: {
        bg: 'blue',
        fg: 'black'
      }
    }
  });
  this.box4 = blessed.box({
    content: 'left/right: switch boards | up/down/mouse: scroll {|} {green-fg}PM2{/} Monitoring {red-fg}(To go further check out https://app.keymetrics.io){/}',
    left: '0%',
    top: '94%',
    width: '100%',
    height: '6%',
    valign: 'middle',
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

  this.list.focus();

  this.screen.append(this.list);
  this.screen.append(this.box1);
  this.screen.append(this.box2);
  this.screen.append(this.box3);
  this.screen.append(this.box4);

  this.list.setLabel(' Processes ');
  // this.list.setRows([
  //   ['Id', 'Name', 'Mem (MB)', 'Cpu (%)', 'Status']
  // ]);

  this.screen.render();

  var that = this;

  var i = 0;
  var boards = ['list', 'box1', 'box2', 'box3'];
  this.screen.key(['left', 'right'], function(ch, key) {
    (key.name === 'left') ? i-- : i++;
    if (i == 4)
      i = 0;
    if (i == -1)
      i = 3;
    that[boards[i]].focus();
    that[boards[i]].style.border.fg = 'blue';
    if (key.name === 'left') {
      if (i == 3)
        that[boards[0]].style.border.fg = 'white';
      else
        that[boards[i + 1]].style.border.fg = 'white';
    }
    else {
       if (i == 0)
        that[boards[3]].style.border.fg = 'white';
      else
        that[boards[i - 1]].style.border.fg = 'white';
    }
  });

  this.screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    this.screen.destroy();
    process.exit(0);
  });

  return this;
}

/**
 * Refresh monitor
 * @method refresh
 * @param {} processes
 * @return this
 */
Monit.refresh = function(processes, client) {
  debug('Monit refresh');

  //console.log(client)

  if(!processes) {
    this.list.setLine(0, 'No process available');
    this.screen.render();
    return;
  }
  
  // this.box3.setLine(0, 'CPU{|}' + String(Math.floor(os.loadavg()[0] * 100 / os.cpus().length)) + ' % ');
  // this.box3.setLine(1, 'Memory{|}' + String(((totalMem - os.freemem()) / 1048576).toFixed(2)) + ' MB');

  if (processes.length != this.list.items.length) {
    this.list.clearItems();
  }

  var mem = 0;
  processes.forEach(function(proc) {
    mem += proc.monit.memory;
  })

  for (var i = 0; i < processes.length; i++) {
    //var memPercent = Math.log(memory + 1) * (100 / Math.log(totalMem));
    var memPercent = (processes[i].monit.memory / mem) * 100;

    var status = processes[i].pm2_env.status == 'online' ? '{green-fg}' : '{red-fg}';
    status = status + '{bold}' + processes[i].pm2_env.status + '{/}';

    var name = processes[i].pm2_env.name || p.basename(processes[i].pm2_env.pm_exec_path);
    var item = '[' + processes[i].pm2_env.pm_id + '] ' + name + '{|} Mem: {' + gradient(memPercent, [255, 0, 0], [0, 255, 0]) + '-fg}' + (processes[i].monit.memory / 1048576).toFixed(2) + '{/} MB   Cpu: {' + gradient(processes[i].monit.cpu, [255, 0, 0], [0, 255, 0]) + '-fg}' + processes[i].monit.cpu + '{/} %   ' + status;
    
    if (this.list.getItem(i)) {
      this.list.setItem(i, item);
    }
    else {
      this.list.pushItem(item);
    }

    //var item = [String(processes[i].pm2_env.pm_id), String(name), String((processes[i].monit.memory / 1048576).toFixed(2)), String(processes[i].monit.cpu), status];
   
    // var tmp = this.list.rows;
    // if (tmp && tmp[i + 1]) {
    //   tmp[i + 1] = item;
    // }
    // else {
    //   tmp.push(item);
    // }
    // this.list.setRows(tmp);

    var proc = processes[this.list.selected];

    if (!proc.pm2_env.versioning) {
      this.box2.setContent('');
    }

    this.box2.setLine(0, 'Restarts :            ' + proc.pm2_env.restart_time + ' ');
    this.box2.setLine(1, 'Uptime :              ' + ((proc.pm2_env.pm_uptime && proc.pm2_env.status == 'online') ? timeSince(proc.pm2_env.pm_uptime) : 0) + ' ');
    this.box2.setLine(2, 'Script path :         ' + proc.pm2_env.pm_exec_path + ' ');
    this.box2.setLine(3, 'Script args :         ' + (proc.pm2_env.args ? (typeof proc.pm2_env.args == 'string' ? JSON.parse(proc.pm2_env.args.replace(/'/g, '"')):proc.pm2_env.args).join(' ') : 'N/A') + ' ');
    this.box2.setLine(4, 'Exec mode :           ' + proc.pm2_env.exec_mode + ' ');
    this.box2.setLine(5, 'Node.js version :     ' + proc.pm2_env.node_version + ' ');
    this.box2.setLine(6, 'watch & reload :      ' + (proc.pm2_env.watch ? '{green-fg}{bold}✔{/}' : '{red-fg}{bold}✘{/}') + ' ');
    this.box2.setLine(7, 'Unstable restarts :   ' + proc.pm2_env.unstable_restarts + ' ');
    this.box2.setLine(8, 'Created at :          ' + new Date(proc.pm2_env.created_at).toISOString() + ' ');
    
    if (proc.pm2_env.versioning) {
      this.box2.setLine(10, 'Revision control :    ' + proc.pm2_env.versioning.type + ' ');
      this.box2.setLine(11, 'Remote url :          ' + proc.pm2_env.versioning.url + ' ');
      this.box2.setLine(12, 'Repository root :     ' + proc.pm2_env.versioning.repo_path + ' ');
      this.box2.setLine(13, 'Last update :         ' + proc.pm2_env.versioning.update_time + ' ');
      this.box2.setLine(14, 'Revision :            ' + proc.pm2_env.versioning.revision + ' ');
      this.box2.setLine(15, 'Comment :             ' + proc.pm2_env.versioning.comment + ' ');
      this.box2.setLine(16, 'Branch :              ' + proc.pm2_env.versioning.branch + ' ');
    }

    //console.log(proc.pm2_env.axm_monitor)
    this.box3.setContent('');
    var j = 0;
    for(var monitor in proc.pm2_env.axm_monitor) {
      this.box3.setLine(j, monitor + ' : ' + proc.pm2_env.axm_monitor[monitor].value + ' ');
      j++;
    }

    this.screen.render();
  }

  return this;
}

/**
 * Put Log
 * @method log
 * @param {} data
 * @return this
 */
Monit.log = function(type, data) {
  switch (type) {
    case 'PM2':
      var color = '{blue-fg}';
      break;
    case 'out':
      var color = '{green-fg}';
      break;
    case 'err':
      var color = '{red-fg}';
      break;
    default:
      var color = '{white-fg}';
  }
  this.box1.pushLine(color + data.process.name + '{/} > ' + data.data.replace(/\n/g, ''));

  return this;
}

module.exports = Monit;

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

function gradient(p, rgb_beginning, rgb_end) {

    var w = (p / 100) * 2 - 1;

    var w1 = (w + 1) / 2.0;
    var w2 = 1 - w1;

    var rgb = [parseInt(rgb_beginning[0] * w1 + rgb_end[0] * w2),
        parseInt(rgb_beginning[1] * w1 + rgb_end[1] * w2),
            parseInt(rgb_beginning[2] * w1 + rgb_end[2] * w2)];

    return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
}
