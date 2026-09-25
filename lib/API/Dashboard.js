/**
 * Copyright 2013-present the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */

var os         = require('os');
var p          = require('path');
var blessed    = require('../../modules/blessed');
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
  // Parallel to logLines, in the same oldest-first order. Holds the
  // untruncated plain text plus metadata so Enter can show more than the
  // fixed-width, non-wrapping log list.
  this.rawLogLines = {}
  this.currentProcessId = null
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

  // `select` only fires on Enter (List.enterSelected). `select item` fires
  // on every up/down move and on setItems(), so it must not open this overlay.
  this.logBox.on('select', (item, index) => {
    this.showLogDetail(index);
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
    content: ' left/right: switch boards | up/down/mouse: scroll | Ctrl-up/down: page | enter: full line | Ctrl-C: exit{|} {cyan-fg}{bold}To go further check out https://pm2.io/{/}  ',
    left: '0%',
    bottom: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: {
      fg: 'white'
    }
  });

  // Overlay for one full log line. A box, not a list, so the text wraps
  // instead of being clipped to the pane width.
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
    this.currentProcessId = process_id
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

  var receivedAt = new Date();
  lines.forEach((line) => {
    this.pushLine(data.process.pm_id, data.process.name, type, line, { receivedAt: receivedAt });
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
 * Make a raw log line safe for a blessed pane (#5397): keep only what a
 * terminal would leave on screen, and nothing blessed could misread.
 *  - \r: a terminal overwrites the line, keep the last segment
 *    (progress bars, spinners)
 *  - non-SGR escape sequences (cursor moves, erase line, OSC titles…)
 *    are removed; colors (SGR, \x1b[..m) are kept, blessed renders them
 *  - other control characters are dropped, tabs become spaces
 *  - { and } are escaped so they are not parsed as blessed tags
 * @method sanitizeLine
 * @param {String} line
 * @return {String}
 */
Dashboard.sanitizeLine = function(line) {
  line = String(line);

  if (line.indexOf('\r') !== -1) {
    var segments = line.replace(/\r+$/, '').split('\r');
    line = segments[segments.length - 1];
  }

  line = line
    // CSI sequences: keep SGR (final byte m), drop the others
    .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, function(seq) {
      return seq[seq.length - 1] === 'm' ? seq : '';
    })
    // OSC (terminated by BEL or ST) and remaining 2-char escapes
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '')
    .replace(/\x1b[ -\/]*[0-Z\\-~]/g, '')
    .replace(/\t/g, '    ')
    .replace(/[\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]/g, '');

  return blessed.escape(line);
}

/**
 * Append one formatted log line to a process buffer, bounded to maxLines
 * @method pushLine
 * @param {Number} pm_id
 * @param {String} name process name
 * @param {String} type PM2 | out | err
 * @param {String} line
 * @param {Object} [meta]
 * @param {Date} [meta.receivedAt] when the dashboard received a live line.
 *                                 Absent for lines preloaded from a log file.
 * @return this
 */
Dashboard.pushLine = function(pm_id, name, type, line, meta) {
  if (!line || line.length === 0)
    return this;

  if (typeof(this.logLines) === 'undefined')
    this.logLines = {};
  if (typeof(this.rawLogLines) === 'undefined')
    this.rawLogLines = {};
  if (typeof(this.logLines[pm_id]) === 'undefined') {
    this.logLines[pm_id] = [];
    this.rawLogLines[pm_id] = [];
  }
  if (typeof(this.rawLogLines[pm_id]) === 'undefined')
    this.rawLogLines[pm_id] = [];

  line = Dashboard.sanitizeLine(line);
  if (line.length === 0)
    return this;

  var buffer = this.logLines[pm_id];
  var raw = this.rawLogLines[pm_id];
  var color = LOG_COLORS[type] || '{white-fg}';
  var max = this.maxLines || DEFAULT_LOG_LINES;

  buffer.push(color + name + '{/} > ' + line);
  raw.push({
    text: Dashboard.plainLogText(line),
    type: type,
    processName: name,
    receivedAt: (meta && meta.receivedAt) || null
  });

  // bound the buffer per process: drop the oldest lines
  if (buffer.length > max) {
    var drop = buffer.length - max;
    buffer.splice(0, drop);
    raw.splice(0, drop);
  }

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
    var clean = Dashboard.sanitizeLine(line);
    if (clean.length === 0) return;
    var formatted = color + name + '{/} > ' + clean;
    var idx = tail.indexOf(formatted);
    if (idx !== -1) {
      // consume the match so a legitimately repeated line is not dropped
      tail.splice(0, idx + 1);
      return;
    }
    this.pushLine(pm_id, name, type, line, { receivedAt: new Date() });
  });

  return this;
}

/**
 * Plain text of a sanitized log line: ANSI SGR removed (so level words
 * are detectable) and blessed {open}/{close} escapes turned back into braces.
 * @method plainLogText
 * @param {String} line
 * @return {String}
 */
Dashboard.plainLogText = function(line) {
  return stripAnsiCodes(String(line))
    .replace(/\{open\}/g, '{')
    .replace(/\{close\}/g, '}');
}

/**
 * Metadata for the log line at a display index. The list shows newest first
 * (displayLines reverses the buffer); rawLogLines stays oldest first.
 * @method logEntryAt
 * @param {Number} pm_id
 * @param {Number} displayIndex
 * @return {Object|null}
 */
Dashboard.logEntryAt = function(pm_id, displayIndex) {
  var entries = this.rawLogLines && this.rawLogLines[pm_id];
  if (!entries || displayIndex < 0 || displayIndex >= entries.length)
    return null;
  return entries[entries.length - 1 - displayIndex] || null;
}

/**
 * Blessed content for the log-line detail overlay.
 * @method formatLogDetail
 * @param {Object} entry
 * @return {String}
 */
Dashboard.formatLogDetail = function(entry) {
  var streamLabels = {
    PM2: 'pm2 (internal)',
    out: 'stdout',
    err: 'stderr'
  };
  var streamLabel = streamLabels[entry.type] || entry.type;

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

  var received = entry.receivedAt
    ? entry.receivedAt.toLocaleString()
    : '{grey-fg}(loaded from log file){/}';

  return [
    '{bold}Process{/}        ' + entry.processName,
    '{bold}Stream{/}         ' + streamLabel,
    '{bold}Received at{/}    ' + received,
    '{bold}Log timestamp{/}  ' + (detectedTimestamp || '{grey-fg}(none detected in line){/}'),
    '{bold}Log level{/}      ' + (detectedLevel
      ? '{' + levelColor + '-fg}{bold}' + detectedLevel.toUpperCase() + '{/}'
      : '{grey-fg}(none detected in line){/}'),
    '',
    '{underline}Full line{/}',
    entry.text
  ].join('\n');
}

/**
 * Show the full text of one logBox line. Display index 0 is the newest line.
 * @method showLogDetail
 * @param {Number} index
 * @return this
 */
Dashboard.showLogDetail = function(index) {
  var entry = this.logEntryAt(this.currentProcessId, index);
  if (!entry || !this.detailBox)
    return this;

  this.detailBox.setContent(Dashboard.formatLogDetail(entry));
  this.detailBox.scrollTo(0);
  this.detailBox.show();
  this.detailBox.setFront();
  this.detailBox.focus();
  this.screen.render();

  return this;
}

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
