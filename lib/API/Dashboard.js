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
  // Parallel to logLines (display strings with color tags), but holding
  // the untruncated raw text + metadata for each line so the detail
  // overlay (see showLogDetail) can show more than what fits in logBox's
  // fixed-width, non-wrapping list rendering.
  this.rawLogLines = {}
  this.currentProcessId = null

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

  // NOTE for pm2 maintainers: `select` only fires on Enter (List.enterSelected),
  // unlike `select item` which fires on every up/down navigation too
  // (List.prototype.select) — see widgets/list.js. That distinction is what
  // makes it safe to open a heavyweight detail overlay here without it
  // popping open on every arrow-key scroll or refresh-driven setItems() call.
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

  this.logBox.on('select', (item, index) => {
    this.showLogDetail(index);
  });

  this.metadataBox = blessed.box({
    label: ' Metadata ',
    top: '70%',
    left: WIDTH_LEFT_PANEL + '%',
    width: 100 - WIDTH_LEFT_PANEL + '%',
    height: '26%',
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
    height: '26%',
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
    content: ' left/right: switch boards | up/down/mouse: scroll | enter on a log line: view full line | Ctrl-C: exit{|} {cyan-fg}{bold}To go further check out https://pm2.io/{/}  ',
    left: '0%',
    top: '95%',
    width: '100%',
    height: '6%',
    valign: 'middle',
    tags: true,
    style: {
      fg: 'white'
    }
  });

  // Overlay shown on top of everything else when a log line is opened via
  // Enter in logBox (see showLogDetail). Hidden by default. A plain `box`
  // (not `list`) is used deliberately so text wraps instead of clipping —
  // that's the whole point vs. logBox's one-line-per-item rendering.
  this.detailBox = blessed.box({
    label: ' Log Line Detail (Enter to close) ',
    top: 'center',
    left: 'center',
    width: '84%',
    height: '70%',
    padding: DEFAULT_PADDING,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: ' ',
      inverse: false
    },
    keys: true,
    tags: true,
    wrap: true,
    hidden: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      border: {
        fg: 'yellow'
      },
      scrollbar: {
        bg: 'blue',
        fg: 'black'
      }
    }
  });

  this.detailBox.key(['enter'], () => {
    this.detailBox.hide();
    this.logBox.focus();
    this.screen.render();
  });

  this.list.focus();

  this.screen.append(this.list);
  this.screen.append(this.logBox);
  this.screen.append(this.metadataBox);
  this.screen.append(this.metricsBox);
  this.screen.append(this.box4);
  this.screen.append(this.detailBox);

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
    this.currentProcessId = process_id
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
  if(typeof(this.rawLogLines[data.process.pm_id]) == "undefined"){
    this.rawLogLines[data.process.pm_id]=[];
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
      this.rawLogLines[data.process.pm_id].push({
        // Loggers like Winston wrap level words in raw ANSI SGR codes
        // (e.g. "\x1b[32minfo\x1b[39m:") when they think they're writing to
        // a TTY. Left in place, the escape sequence's trailing letter (the
        // "m" in "\x1b[32m") sits directly against the level word with no
        // word boundary between them, which silently breaks the \b-based
        // detection in showLogDetail. Stripping them also happens to make
        // the detail view's "Full line" cleaner to read.
        text: stripAnsiCodes(log),
        type: type,
        processName: data.process.name,
        receivedAt: new Date()
      })


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
        this.rawLogLines[leading_process_id].shift()
      }
    }
  })

  return this;
}

/**
 * Show the full, untruncated text (+ metadata) of one logBox line in the
 * detail overlay. Triggered by pressing Enter on a selected line in logBox.
 * @method showLogDetail
 * @param {Number} index index of the line within the currently displayed
 *                        process's log buffer (matches logBox's own item
 *                        order, since both are built from the same array)
 * @return this
 */
Dashboard.showLogDetail = function(index) {
  var entries = this.rawLogLines[this.currentProcessId];
  if (!entries || !entries[index]) {
    return this;
  }

  var entry = entries[index];

  var streamLabels = {
    PM2: 'pm2 (internal)',
    out: 'stdout',
    err: 'stderr'
  };
  var streamLabel = streamLabels[entry.type] || entry.type;

  // Best-effort: most log lines here are already prefixed by whatever
  // logging library the app uses (Winston, pino, console, pm2 itself...),
  // not by pm2 itself, so this is just a convenience guess, not a
  // guarantee - shown as "(none detected)" when it doesn't match.
  var tsMatch = entry.text.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\S*\]?:?\s*/);
  var detectedTimestamp = tsMatch ? tsMatch[1] : null;
  var remainder = tsMatch ? entry.text.slice(tsMatch[0].length) : entry.text;

  var levelMatch = remainder.match(/\b(fatal|error|warn(?:ing)?|info|notice|debug|trace)\b/i);
  var detectedLevel = levelMatch ? levelMatch[1].toLowerCase() : null;
  var levelColors = {
    fatal: 'red', error: 'red', warn: 'yellow', warning: 'yellow',
    info: 'green', notice: 'cyan', debug: 'blue', trace: 'white'
  };
  var levelColor = levelColors[detectedLevel] || 'white';

  var lines = [
    '{bold}Process{/}        ' + entry.processName,
    '{bold}Stream{/}         ' + streamLabel,
    '{bold}Received at{/}    ' + entry.receivedAt.toLocaleString(),
    '{bold}Log timestamp{/}  ' + (detectedTimestamp || '{grey-fg}(none detected in line){/}'),
    '{bold}Log level{/}      ' + (detectedLevel
      ? '{' + levelColor + '-fg}{bold}' + detectedLevel.toUpperCase() + '{/}'
      : '{grey-fg}(none detected in line){/}'),
    '',
    '{underline}Full line{/}',
    entry.text
  ];

  this.detailBox.setContent(lines.join('\n'));
  this.detailBox.scrollTo(0);
  this.detailBox.show();
  this.detailBox.setFront();
  this.detailBox.focus();
  this.screen.render();

  return this;
};

module.exports = Dashboard;

// eslint-disable-next-line no-control-regex
var ANSI_RE = /\x1b\[[0-9;]*m/g;
function stripAnsiCodes(str) {
  return str.replace(ANSI_RE, '');
}

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
