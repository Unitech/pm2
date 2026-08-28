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

// Default / maximum number of log lines preloaded and kept per process
var DEFAULT_LOG_LINES = 200;
var MAX_LOG_LINES = 10000;

var LOG_COLORS = {
  PM2 : '{blue-fg}',
  out : '{green-fg}',
  err : '{red-fg}'
};

/**
 * Synchronous Dashboard init method
 * @method init
 * @param {Object} opts
 * @param {Number} opts.lines number of log lines per process (default 200)
 * @return this
 */
Dashboard.init = function(opts) {
  opts = opts || {};

  // Init Screen
  this.screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true
  });
  this.screen.title = 'PM2 Dashboard';

  this.logLines = {}
  this.maxLines = Dashboard.parseLines(opts.lines);

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

  // Re-render the side panes right away from the last process list
  // received, instead of waiting for the next getMonitorData tick
  this.list.on('select item', (item, i) => {
    this.logBox.clearItems()
    if (this.processes)
      this.refresh(this.processes);
  })

  // Page-wise scrolling of the focused log pane: Ctrl+Up / Ctrl+Down
  // (PageUp / PageDown as well)
  var pageScroll = (direction, key) => {
    if (!this.logBox.focused) return;
    var page = Math.max(1, this.logBox.height - this.logBox.iheight);
    // the list's own 'up'/'down' handler still runs after this one for
    // Ctrl+arrows (it ignores the modifier) and moves one more line
    if (key.ctrl) page -= 1;
    this.logBox.move(direction * page);
    this.screen.render();
  };
  this.screen.key(['C-up', 'pageup'], (ch, key) => pageScroll(-1, key));
  this.screen.key(['C-down', 'pagedown'], (ch, key) => pageScroll(1, key));

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
    bottom: 1,
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
    bottom: 1,
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
    content: ' left/right: switch boards | up/down/mouse: scroll | Ctrl-up/down: page | Ctrl-C: exit{|} {cyan-fg}{bold}To go further check out https://pm2.io/{/}  ',
    left: '0%',
    bottom: 0,
    width: '100%',
    height: 1,
    tags: true,
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

  // keep the last list around for instant re-rendering on selection change
  this.processes = processes;

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
    let logs = this.displayLines(process_id);
    if(logs !== null){
      // blessed's setItems restores the selection by *content*, which
      // jumps to the first duplicate line: keep the numeric index instead
      var selected = this.logBox.selected;
      this.logBox.setItems(logs)
      if (!this.logBox.focused) {
          // newest line first: stay pinned to the top until focused
          this.logBox.select(0);
          this.logBox.setScrollPerc(0);
      } else {
          this.logBox.select(Math.min(selected, logs.length - 1));
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
    // inner width minus the scrollbar column blessed keeps on the right,
    // minus one so the line never reaches the wrap threshold
    var metrics_width = this.metricsBox.width - this.metricsBox.iwidth - 2;
    var metric_lines = Dashboard.formatMetrics(proc.pm2_env.axm_monitor, metrics_width);
    for (var m = 0; m < metric_lines.length; m++) {
      var probe = metric_lines[m];

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
  var lines = (data.data || '').split('\n');

  lines.forEach((line) => {
    this.pushLine(data.process.pm_id, data.process.name, type, line);
  });

  return this;
}

/**
 * Render a metric value: numbers (or numeric strings) are rounded to two
 * decimals, integers are left untouched, anything else is stringified
 * @method formatMetricValue
 * @param {*} value
 * @return {String}
 */
Dashboard.formatMetricValue = function(value) {
  if (typeof value === 'boolean' || value === '')
    return String(value);
  var n = typeof value === 'number' ? value : Number(value);
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '' || isNaN(n)))
    return String(value);
  if (!isFinite(n))
    return String(value);
  if (Number.isInteger(n))
    return String(n);
  return n.toFixed(2);
}

/**
 * Format the custom metrics of a process as aligned columns:
 * name on the left, value right-aligned, unit in a fixed-width column
 * @method formatMetrics
 * @param {Object} axm_monitor
 * @return {Array<String>} one blessed-tagged line per metric
 */
Dashboard.formatMetrics = function(axm_monitor, width) {
  var metrics = Object.keys(axm_monitor || {}).map(function(key) {
    var m = axm_monitor[key];
    var has_value = m !== null && typeof m === 'object' && m.hasOwnProperty('value');
    var value = has_value ? m.value : m;
    var unit = (m !== null && typeof m === 'object' && m.unit) ? String(m.unit) : '';
    if (value === undefined || value === null || (typeof value === 'object'))
      value = '';
    return { key: key, value: Dashboard.formatMetricValue(value), unit: unit };
  });

  var value_width = metrics.reduce(function(w, m) { return Math.max(w, m.value.length); }, 0);
  var unit_width = metrics.reduce(function(w, m) { return Math.max(w, m.unit.length); }, 0);

  return metrics.map(function(m) {
    var cols = m.value.padStart(value_width);
    if (unit_width > 0)
      cols += ' ' + m.unit.padEnd(unit_width);
    var key = m.key;
    if (!width)
      return `{bold}${key}{/} {|} ${cols}`;

    // Known pane width: pad by hand. blessed's `{|}` is measured before it
    // is expanded (as 3 literal chars) and lines reaching the width are
    // cut, which used to drop the unit column. Shorten the name rather
    // than letting the value overflow.
    var max_key = width - cols.length - 1;
    if (key.length > max_key)
      key = max_key > 1 ? key.substring(0, max_key - 1) + '…' : '';
    var gap = ' '.repeat(Math.max(1, width - key.length - cols.length));
    return `{bold}${key}{/}${gap}${cols}`;
  });
}

/**
 * Lines of a process as displayed: most recent first
 * @method displayLines
 * @param {Number} pm_id
 * @return {Array|null} null when the process has no line yet
 */
Dashboard.displayLines = function(pm_id) {
  var buffer = this.logLines && this.logLines[pm_id];
  if (typeof(buffer) === 'undefined')
    return null;
  return buffer.slice().reverse();
}

/**
 * Parse a --lines value: positive integer, DEFAULT_LOG_LINES otherwise
 * @method parseLines
 * @param {*} value
 * @return {Number}
 */
Dashboard.parseLines = function(value) {
  var n = parseInt(value, 10);
  if (isNaN(n) || n <= 0)
    return DEFAULT_LOG_LINES;
  return Math.min(n, MAX_LOG_LINES);
}

/**
 * Append one formatted log line to a process buffer, bounded to maxLines
 * @method pushLine
 * @param {Number} pm_id
 * @param {String} name process name
 * @param {String} type PM2 | out | err
 * @param {String} line
 * @return this
 */
Dashboard.pushLine = function(pm_id, name, type, line) {
  if (!line || line.length === 0)
    return this;

  if (typeof(this.logLines) === 'undefined')
    this.logLines = {};
  if (typeof(this.logLines[pm_id]) === 'undefined')
    this.logLines[pm_id] = [];

  var buffer = this.logLines[pm_id];
  var color = LOG_COLORS[type] || '{white-fg}';
  var max = this.maxLines || DEFAULT_LOG_LINES;

  buffer.push(color + name + '{/} > ' + line);

  // bound the buffer per process: drop the oldest lines
  if (buffer.length > max)
    buffer.splice(0, buffer.length - max);

  return this;
}

/**
 * Preload the history of a process from its out/err log files
 * (called before live log events start flowing)
 * @method preload
 * @param {Object} proc process object (pm_id, name)
 * @param {Array} out_lines last lines of the out log file
 * @param {Array} err_lines last lines of the err log file
 * @return this
 */
Dashboard.preload = function(proc, out_lines, err_lines) {
  var merged = Dashboard.mergeLogLines(out_lines || [], err_lines || []);

  merged.forEach((entry) => {
    this.pushLine(proc.pm_id, proc.name, entry.type, entry.line);
  });

  return this;
}

/**
 * Merge out and err lines into one chronological stream.
 * Lines are interleaved by their leading timestamp when both streams
 * carry one (log_date_format / --time); otherwise out lines come first,
 * then err lines. Order within a stream is always preserved (stable).
 * @method mergeLogLines
 * @param {Array} out_lines
 * @param {Array} err_lines
 * @return {Array} [{ type: 'out'|'err', line: String }]
 */
Dashboard.mergeLogLines = function(out_lines, err_lines) {
  // Parse a leading timestamp: "2026-08-28T10:00:00: msg",
  // "2026-08-28 10:00:00 +02:00: msg" (pm2 default log_date_format)
  var stamp = function(line) {
    var m = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?: ?[+-]\d{2}:?\d{2}| ?Z)?)/.exec(line);
    if (!m) return NaN;
    return Date.parse(m[1].replace(' ', 'T').replace(/ (?=[+-]\d|Z)/, ''));
  };

  // Stamp each line; continuation lines (stack traces, multi-line JSON)
  // inherit the stamp of the previous line of their stream
  var tag = function(lines, type) {
    var last = NaN;
    var stamped = 0;
    var entries = lines.map(function(line) {
      var ts = stamp(line);
      if (!isNaN(ts)) { last = ts; stamped++; }
      return { type: type, line: line, ts: last };
    });
    entries.stamped = stamped;
    return entries;
  };

  var out = tag(out_lines, 'out');
  var err = tag(err_lines, 'err');

  var strip = function(e) { return { type: e.type, line: e.line }; };

  // no interleaving possible without timestamps on both sides
  if (out.length === 0 || err.length === 0 || out.stamped === 0 || err.stamped === 0)
    return out.concat(err).map(strip);

  // two-pointer merge, stable within each stream; leading lines without
  // any stamp yet (NaN) are emitted first
  var result = [];
  var i = 0, j = 0;
  while (i < out.length && j < err.length) {
    var a = out[i].ts, b = err[j].ts;
    if (isNaN(a) || (!isNaN(b) && a <= b))
      result.push(out[i++]);
    else
      result.push(err[j++]);
  }
  return result.concat(out.slice(i), err.slice(j)).map(strip);
}

/**
 * Replay a live log event buffered during the history preload, skipping
 * lines already loaded from the file (a line emitted during the preload
 * window is both in the file and on the bus)
 * @method replay
 * @param {String} type
 * @param {Object} data
 * @return this
 */
Dashboard.replay = function(type, data) {
  var pm_id = data.process.pm_id;
  var name = data.process.name;
  var buffer = (this.logLines && this.logLines[pm_id]) || [];
  var color = LOG_COLORS[type] || '{white-fg}';
  // only the tail of the history can overlap with buffered live events
  var tail = buffer.slice(-50);

  (data.data || '').split('\n').forEach((line) => {
    if (line.length === 0) return;
    var formatted = color + name + '{/} > ' + line;
    var idx = tail.indexOf(formatted);
    if (idx !== -1) {
      // consume the match so a legitimately repeated line is not dropped
      tail.splice(0, idx + 1);
      return;
    }
    this.pushLine(pm_id, name, type, line);
  });

  return this;
}

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
