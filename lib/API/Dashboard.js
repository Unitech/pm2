/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var os         = require('os');
var p          = require('path');
var blessed    = require('@pm2/blessed');
var debug      = require('debug')('pm2:monit');

// Total memory
const totalMem = os.totalmem();

var Dashboard = {};

var DEFAULT_PADDING = {
  top : 0,
  left : 1,
  right : 1
};

var WIDTH_LEFT_PANEL = 30;

/**
 * Synchronous Dashboard init method
 * @method init
 * @return this
 */
Dashboard.init = function() {
  // Init Screen
  this.screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true
  });
  this.screen.title = 'PM2 Dashboard';

  this.logLines = {}

  // Tracks which footer layout (see setSpeedbarLayout) is currently
  // active. Starts false to match the widgets' own initial values below
  // (metadataBox/metricsBox at 26%, box4 at 95%/6%, speedbarBox hidden).
  this.speedbarLayoutActive = false

  this.list = blessed.list({
    top: '0',
    left: '0',
    width: WIDTH_LEFT_PANEL + '%',
    height: '70%',
    padding: 0,
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

  this.list.on('select item', (item, i) => {
    this.logBox.clearItems()
  })

  this.logBox = blessed.list({
    label: ' Logs ',
    top: '0',
    left: WIDTH_LEFT_PANEL + '%',
    width: 100 - WIDTH_LEFT_PANEL + '%',
    height: '70%',
    padding: DEFAULT_PADDING,
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

  this.metadataBox = blessed.box({
    label: ' Metadata ',
    top: '70%',
    left: WIDTH_LEFT_PANEL + '%',
    width: 100 - WIDTH_LEFT_PANEL + '%',
    // Height is toggled at runtime between '25%' (no speedbar) and '21%'
    // (speedbar visible, its ~5% carved out of this panel) by
    // setSpeedbarLayout() below. 25%, not pm2's original 26%: stock pm2 has
    // this panel ending at 70+26=96%, one point past box4's own top (95%),
    // so at certain terminal row counts (rounding-dependent - e.g. exactly
    // 50 rows; most other row counts happen to round away from it) box4
    // paints over this panel's bottom border row since it's appended after
    // it. 25% closes that gap everywhere instead of only at the specific
    // sizes stock pm2's rounding happens to dodge it at.
    height: '25%',
    padding: DEFAULT_PADDING,
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

  this.metricsBox = blessed.list({
    label: ' Custom Metrics ',
    top: '70%',
    left: '0%',
    width: WIDTH_LEFT_PANEL + '%',
    // See matching comment on metadataBox above.
    height: '25%',
    padding: DEFAULT_PADDING,
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

  this.box4 = blessed.text({
    content: ' left/right: switch boards | up/down/mouse: scroll | Ctrl-C: exit{|} {cyan-fg}{bold}To go further check out https://pm2.io/{/}  ',
    left: '0%',
    // top/height toggled at runtime between '95%'/'5%' (no speedbar) and
    // '91%'/'4%' (speedbar visible) by setSpeedbarLayout() below. Stock
    // pm2 uses '95%'/'6%' here (ending at 101%, one past the screen and
    // one past metadataBox/metricsBox's own bottom edge - see comment on
    // metadataBox above for why that 1% causes a missing-border glitch at
    // some terminal sizes); '5%' ends exactly at 100% with zero overlap.
    top: '95%',
    width: '100%',
    height: '5%',
    valign: 'middle',
    tags: true,
    style: {
      fg: 'white'
    }
  });

  // Host metrics line ("speedbar"), same data/format as the `host metrics`
  // row `pm2 status`/`pm2 ls` prints when `pm2:sysmonit` is enabled (see
  // lib/API/UX/pm2-ls.js's miniMonitBar - buildSpeedbarLine below is that
  // same logic, rendered with blessed content tags instead of chalk/ansis
  // escape codes). Starts hidden; refreshSystemData() shows it (and grows
  // metadataBox/metricsBox's neighboring layout to make room, via
  // setSpeedbarLayout()) the moment a non-empty getSystemData response
  // arrives, and hides it again the moment one isn't - e.g. `pm2:sysmonit`
  // is off - so there's no reserved dead space when there's nothing to show.
  this.speedbarBox = blessed.text({
    content: '',
    left: '0%',
    top: '95%',
    width: '100%',
    height: '5%',
    valign: 'middle',
    tags: true,
    hidden: true,
    style: {
      fg: 'white'
    }
  });

  this.list.focus();

  this.screen.append(this.list);
  this.screen.append(this.logBox);
  this.screen.append(this.metadataBox);
  this.screen.append(this.metricsBox);
  this.screen.append(this.box4);
  this.screen.append(this.speedbarBox);

  this.list.setLabel(' Process List ');

  this.screen.render();

  var that = this;

  var i = 0;
  var boards = ['list', 'logBox', 'metricsBox', 'metadataBox'];
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

  // async refresh of the ui
  setInterval(function () {
    that.screen.render();
  }, 300);

  return this;
}

/**
 * Refresh dashboard
 * @method refresh
 * @param {} processes
 * @return this
 */
Dashboard.refresh = function(processes) {
  debug('Monit refresh');

  if(!processes) {
    this.list.setItem(0, 'No process available');
    return;
  }

  if (processes.length != this.list.items.length) {
    this.list.clearItems();
  }

  // Total of processes memory
  var mem = 0;
  processes.forEach(function(proc) {
    mem += proc.monit.memory;
  })

  // Sort process list
  processes.sort(function(a, b) {
    if (a.pm2_env.name < b.pm2_env.name)
      return -1;
    if (a.pm2_env.name > b.pm2_env.name)
      return 1;
    return 0;
  });

  // Loop to get process infos
  for (var i = 0; i < processes.length; i++) {
    // Percent of memory use by one process in all pm2 processes
    var memPercent = (processes[i].monit.memory / mem) * 100;

    // Status of process
    var status = processes[i].pm2_env.status == 'online' ? '{green-fg}' : '{red-fg}';
    status = status + '{bold}' + processes[i].pm2_env.status + '{/}';

    var name = processes[i].pm2_env.name || p.basename(processes[i].pm2_env.pm_exec_path);
    var maxNameLen = 15;
    if (name.length > maxNameLen) name = name.substring(0, maxNameLen - 1) + '…';
    name = name.padEnd(maxNameLen);

    // Line of list
    var memMB = (processes[i].monit.memory / 1048576).toFixed(0);
    var cpu = processes[i].monit.cpu;
    var memColor = gradient(memPercent, [255, 0, 0], [0, 255, 0]);
    var cpuColor = gradient(cpu, [255, 0, 0], [0, 255, 0]);
    var item = `[${String(processes[i].pm2_env.pm_id).padStart(2)}] ${name} Mem: {bold}{${memColor}-fg}${String(memMB).padStart(3)}{/} MB  CPU: {bold}{${cpuColor}-fg}${String(cpu).padStart(2)}{/} %  ${status}`;

    // Check if item exist
    if (this.list.getItem(i)) {
      this.list.setItem(i, item);
    }
    else {
      this.list.pushItem(item);
    }

    var proc = processes[this.list.selected];
    // render the logBox
    let process_id = proc.pm_id
    let logs = this.logLines[process_id];
    if(typeof(logs) !== "undefined"){
      this.logBox.setItems(logs)
      if (!this.logBox.focused) {
          this.logBox.setScrollPerc(100);
      }
    }else{
      this.logBox.clearItems();
    }
    this.logBox.setLabel(`  ${proc.pm2_env.name} Logs  `)

    this.metadataBox.setLine(0, 'App Name              ' + '{bold}' + proc.pm2_env.name + '{/}');
    this.metadataBox.setLine(1, 'Namespace             ' + '{bold}' + proc.pm2_env.namespace + '{/}');
    this.metadataBox.setLine(2, 'Version               ' + '{bold}' + proc.pm2_env.version + '{/}');
    this.metadataBox.setLine(3, 'Restarts              ' + proc.pm2_env.restart_time);
    this.metadataBox.setLine(4, 'Uptime                ' + ((proc.pm2_env.pm_uptime && proc.pm2_env.status == 'online') ? timeSince(proc.pm2_env.pm_uptime) : 0));
    this.metadataBox.setLine(5, 'Script path           ' + proc.pm2_env.pm_exec_path);
    this.metadataBox.setLine(6, 'Script args           ' + (proc.pm2_env.args ? (typeof proc.pm2_env.args == 'string' ? JSON.parse(proc.pm2_env.args.replace(/'/g, '"')):proc.pm2_env.args).join(' ') : 'N/A'));
    this.metadataBox.setLine(7, 'Interpreter           ' + proc.pm2_env.exec_interpreter);
    this.metadataBox.setLine(8, 'Interpreter args      ' + (proc.pm2_env.node_args.length != 0 ? proc.pm2_env.node_args : 'N/A'));
    this.metadataBox.setLine(9, 'Exec mode             ' + (proc.pm2_env.exec_mode == 'fork_mode' ? '{bold}fork{/}' : '{blue-fg}{bold}cluster{/}'));
    this.metadataBox.setLine(10, 'Node.js version       ' + proc.pm2_env.node_version);
    this.metadataBox.setLine(11, 'watch & reload        ' + (proc.pm2_env.watch ? '{green-fg}{bold}✔{/}' : '{red-fg}{bold}✘{/}'));
    this.metadataBox.setLine(12, 'Unstable restarts     ' + proc.pm2_env.unstable_restarts);

    this.metadataBox.setLine(13, 'Comment               ' + ((proc.pm2_env.versioning) ? proc.pm2_env.versioning.comment : 'N/A'));
    this.metadataBox.setLine(14, 'Revision              ' + ((proc.pm2_env.versioning) ? proc.pm2_env.versioning.revision : 'N/A'));
    this.metadataBox.setLine(15, 'Branch                ' + ((proc.pm2_env.versioning) ? proc.pm2_env.versioning.branch : 'N/A'));
    this.metadataBox.setLine(16, 'Remote url            ' + ((proc.pm2_env.versioning) ? proc.pm2_env.versioning.url : 'N/A'));
    this.metadataBox.deleteLine(17)
    this.metadataBox.setLine(17, 'Last update           ' + ((proc.pm2_env.versioning) ? proc.pm2_env.versioning.update_time : 'N/A'));

    if (Object.keys(proc.pm2_env.axm_monitor).length != this.metricsBox.items.length) {
      this.metricsBox.clearItems();
    }
    var j = 0;
    for (var key in proc.pm2_env.axm_monitor) {
      var metric_name = proc.pm2_env.axm_monitor[key].hasOwnProperty('value') ? proc.pm2_env.axm_monitor[key].value : proc.pm2_env.axm_monitor[key]
      var metric_unit = proc.pm2_env.axm_monitor[key].hasOwnProperty('unit') ? proc.pm2_env.axm_monitor[key].unit : null
      var probe = `{bold}${key}{/} {|} ${metric_name}${metric_unit == null ? '' : ' ' + metric_unit}`

      if (this.metricsBox.getItem(j)) {
        this.metricsBox.setItem(j, probe);
      }
      else {
        this.metricsBox.pushItem(probe);
      }
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
Dashboard.log = function(type, data) {
  var that = this;

  if(typeof(this.logLines[data.process.pm_id]) == "undefined"){
    this.logLines[data.process.pm_id]=[];
  }
  // Logs colors
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

  var logs = data.data.split('\n')

  logs.forEach((log) => {
    if (log.length > 0) {
      this.logLines[data.process.pm_id].push(color + data.process.name + '{/} > ' + log)


      //removing logs if longer than limit
      let count = 0;
      let max_count = 0;
      let leading_process_id = -1;

      for(var process_id in this.logLines){
        count += this.logLines[process_id].length;
        if( this.logLines[process_id].length > max_count){
          leading_process_id = process_id;
          max_count = this.logLines[process_id].length;
        }
      }

      if (count > 200) {
        this.logLines[leading_process_id].shift()
      }
    }
  })

  return this;
}

/**
 * Refresh the host metrics ("speedbar") line below the help bar.
 * @method refreshSystemData
 * @param {Object} systemdata result of the `getSystemData` remote call -
 *                             empty/absent whenever `pm2:sysmonit` is off
 * @return this
 */
Dashboard.refreshSystemData = function(systemdata) {
  if (!this.speedbarBox) {
    return this;
  }

  var line = buildSpeedbarLine(systemdata);
  setSpeedbarLayout(this, line !== '');
  this.speedbarBox.setContent(line);
  this.screen.render();

  return this;
};

module.exports = Dashboard;

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

// Flips the footer between two fixed layouts: metadataBox/metricsBox at
// their original 26% (no speedbar - box4 back at its original 95%/6%,
// speedbarBox hidden) vs. 21% (speedbar visible in the ~5% carved out
// below box4). Called from refreshSystemData() only when the on/off state
// actually changes, so metadataBox/metricsBox get their space back
// instead of leaving a permanent dead gap whenever `pm2:sysmonit` is off.
function setSpeedbarLayout(dashboard, showSpeedbar) {
  if (dashboard.speedbarLayoutActive === showSpeedbar) {
    return;
  }
  dashboard.speedbarLayoutActive = showSpeedbar;

  if (showSpeedbar) {
    dashboard.metadataBox.height = '21%';
    dashboard.metricsBox.height = '21%';
    dashboard.box4.top = '91%';
    dashboard.box4.height = '4%';
    dashboard.speedbarBox.show();
  } else {
    dashboard.metadataBox.height = '25%';
    dashboard.metricsBox.height = '25%';
    dashboard.box4.top = '95%';
    dashboard.box4.height = '5%';
    dashboard.speedbarBox.hide();
  }

  // blessed's render() normally does an incremental diff against the
  // previous frame's cell buffer and only repaints changed cells - fine
  // for content updates, but when a box's own dimensions shrink/grow, the
  // old frame's characters just outside the new bounds (border lines,
  // trailing metadata rows, etc.) were never marked dirty and won't get
  // erased on the next render(). realloc() resets those buffers so this
  // one screen.render() (called by refreshSystemData right after this
  // function returns) does a full clean repaint. Only happens on an
  // actual on/off transition, not every poll.
  dashboard.screen.realloc();
}

// blessed-tag equivalent of UxHelpers.colorizedMetric (lib/API/UX/helpers.js),
// which returns chalk/ansis-colored strings - not usable here since this
// content goes through blessed's own {tag} styling, not raw ANSI escapes.
// Same green/yellow/red threshold semantics, including the "lower is worse"
// inversion (e.g. RAM Available) when alert < warn.
function colorizeMetric(value, warn, alert, suffix) {
  suffix = suffix || '';

  if (isNaN(value)) {
    return 'N/A';
  }
  if (Number(value) == 0) {
    return '0' + suffix;
  }

  var inverted = alert < warn;
  var danger = inverted ? (value <= alert) : (value >= alert);
  var caution = inverted ? (value <= warn && value > alert) : (value >= warn && value < alert);

  if (danger) {
    return '{red-fg}{bold}' + value + suffix + '{/}';
  }
  if (caution) {
    return '{yellow-fg}{bold}' + value + suffix + '{/}';
  }
  return '{green-fg}' + value + suffix + '{/}';
}

// Builds the single-line host metrics summary shown in speedbarBox. Ported
// from miniMonitBar() in lib/API/UX/pm2-ls.js (the same data backs the
// `host metrics` row `pm2 status`/`pm2 ls` prints), with chalk/ansis output
// swapped for blessed content tags. Keep the two in sync if one changes.
function buildSpeedbarLine(m) {
  if (!m || Object.keys(m).length === 0) {
    return '';
  }

  var cpu = m['CPU Usage'];
  if (typeof cpu === 'undefined') {
    return '';
  }

  var line = '{bold}{cyan-fg}host metrics{/} ';
  line += '| {bold}cpu{/}: ' + colorizeMetric(cpu.value, 40, 70, '%');

  var temp = m['CPU Temperature'] ? m['CPU Temperature'].value : null;
  if (temp && temp != '-1') {
    line += ' ' + colorizeMetric(temp, 50, 70, 'º');
  }

  var ramUsage = m['RAM Usage'] ? m['RAM Usage'].value : null;
  if (ramUsage === null) {
    var memTotal = m['RAM Total'] ? m['RAM Total'].value : null;
    var memAvailable = m['RAM Available'] ? m['RAM Available'].value : null;
    if (memTotal) {
      ramUsage = (100 - ((memAvailable / memTotal) * 100)).toFixed(1);
    }
  }
  if (ramUsage !== null && typeof ramUsage !== 'undefined') {
    line += ' | {bold}ram usage{/}: ' + colorizeMetric(ramUsage, 70, 90, '%');
  }

  if (m['graphics:mem:total'] && Number(m['graphics:mem:total'].value) > 0) {
    var gpuTotal = m['graphics:mem:total'].value;
    var gpuUsed = m['graphics:mem:used'] ? m['graphics:mem:used'].value : 0;
    line += ' | {bold}gpu{/}: ' + gpuUsed + '/' + gpuTotal + 'mb';
    var gpuTemp = m['graphics:temp'] ? m['graphics:temp'].value : null;
    if (gpuTemp && gpuTemp != '-1') {
      line += ' ' + colorizeMetric(gpuTemp, 50, 70, 'º');
    }
  }

  var interfaces = Object.keys(m).filter(function(k) {
    return k.indexOf('net') !== -1 && k !== 'net:default';
  }).map(function(k) {
    return k.split(':')[2];
  }).filter(function(iface, i, self) {
    return self.indexOf(iface) === i;
  });

  interfaces.forEach(function(iface) {
    if (!m['net:rx_5:' + iface]) {
      return;
    }
    var rx = m['net:rx_5:' + iface].value;
    var tx = m['net:tx_5:' + iface] ? m['net:tx_5:' + iface].value : 0;
    // Only show interfaces actually carrying traffic
    if (!(Number(rx) > 0 || Number(tx) > 0)) {
      return;
    }
    line += ' | {bold}' + iface + '{/}: ';
    line += '⇓ ' + colorizeMetric(rx, 10, 20, 'mb/s') + ' ';
    line += '⇑ ' + colorizeMetric(tx, 10, 20, 'mb/s');

    var rxErr = m['net:rx_errors_60:' + iface] ? Number(m['net:rx_errors_60:' + iface].value) : 0;
    var txErr = m['net:tx_errors_60:' + iface] ? Number(m['net:tx_errors_60:' + iface].value) : 0;
    var rxDrop = m['net:rx_dropped_60:' + iface] ? Number(m['net:rx_dropped_60:' + iface].value) : 0;
    var txDrop = m['net:tx_dropped_60:' + iface] ? Number(m['net:tx_dropped_60:' + iface].value) : 0;
    if (rxErr + txErr > 0) {
      line += ' {bold}err{/} ' + colorizeMetric(rxErr + txErr, 1, 10, '/min');
    }
    if (rxDrop + txDrop > 0) {
      line += ' {bold}drop{/} ' + colorizeMetric(rxDrop + txDrop, 1, 10, '/min');
    }
  });

  if (m['Disk Reads']) {
    var read = m['Disk Reads'].value;
    var write = m['Disk Writes'] ? m['Disk Writes'].value : 0;

    line += ' | {bold}disk{/}: ⇓ ' + colorizeMetric(read, 10, 20, 'mb/s');
    line += ' ⇑ ' + colorizeMetric(write, 10, 20, 'mb/s');

    var disks = Object.keys(m).filter(function(k) {
      return k.indexOf('fs:') !== -1;
    }).map(function(k) {
      return k.split(':')[2];
    }).filter(function(fs, i, self) {
      return self.indexOf(fs) === i;
    });

    disks.forEach(function(fs) {
      if (!m['fs:use:' + fs]) {
        return;
      }
      var use = m['fs:use:' + fs].value;
      if (use > 60) {
        line += ' {grey-fg}' + fs + '{/} ' + colorizeMetric(use, 80, 90, '%');
      }
    });
  }

  return line;
}

/* Args :
 *  p : Percent 0 - 100
 *  rgb_ : Array of rgb [255, 255, 255]
 * Return :
 *  Hexa #FFFFFF
 */
function gradient(p, rgb_beginning, rgb_end) {

    var w = (p / 100) * 2 - 1;

    var w1 = (w + 1) / 2.0;
    var w2 = 1 - w1;

    var rgb = [parseInt(rgb_beginning[0] * w1 + rgb_end[0] * w2),
        parseInt(rgb_beginning[1] * w1 + rgb_end[1] * w2),
            parseInt(rgb_beginning[2] * w1 + rgb_end[2] * w2)];

    return "#" + ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
}
