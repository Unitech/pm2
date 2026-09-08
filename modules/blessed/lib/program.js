/**
 * program.js - basic curses-like functionality for blessed.
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

var EventEmitter = require('events').EventEmitter
  , StringDecoder = require('string_decoder').StringDecoder
  , cp = require('child_process')
  , util = require('util')
  , fs = require('fs');

var Tput = require('./tput')
  , colors = require('./colors')
  , slice = Array.prototype.slice;

var nextTick = global.setImmediate || process.nextTick.bind(process);

/**
 * Program
 */

function Program(options) {
  var self = this;

  if (!(this instanceof Program)) {
    return new Program(options);
  }

  Program.bind(this);

  EventEmitter.call(this);

  if (!options || options.__proto__ !== Object.prototype) {
    options = {
      input: arguments[0],
      output: arguments[1]
    };
  }

  this.options = options;
  this.input = options.input || process.stdin;
  this.output = options.output || process.stdout;

  options.log = options.log || options.dump;
  if (options.log) {
    this._logger = fs.createWriteStream(options.log);
    if (options.dump) this.setupDump();
  }

  this.zero = options.zero !== false;
  this.useBuffer = options.buffer;

  this.x = 0;
  this.y = 0;
  this.savedX = 0;
  this.savedY = 0;

  this.cols = this.output.columns || 1;
  this.rows = this.output.rows || 1;

  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;

  this._terminal = options.terminal
    || options.term
    || process.env.TERM
    || (process.platform === 'win32' ? 'windows-ansi' : 'xterm');

  this._terminal = this._terminal.toLowerCase();

  // OSX
  this.isOSXTerm = process.env.TERM_PROGRAM === 'Apple_Terminal';
  this.isiTerm2 = process.env.TERM_PROGRAM === 'iTerm.app'
    || !!process.env.ITERM_SESSION_ID;

  // VTE
  // NOTE: lxterminal does not provide an env variable to check for.
  // NOTE: gnome-terminal and sakura use a later version of VTE
  // which provides VTE_VERSION as well as supports SGR events.
  this.isXFCE = /xfce/i.test(process.env.COLORTERM);
  this.isTerminator = !!process.env.TERMINATOR_UUID;
  this.isLXDE = false;
  this.isVTE = !!process.env.VTE_VERSION
    || this.isXFCE
    || this.isTerminator
    || this.isLXDE;

  // xterm and rxvt - not accurate
  this.isRxvt = /rxvt/i.test(process.env.COLORTERM);
  this.isXterm = false;

  this.tmux = !!process.env.TMUX;
  this.tmuxVersion = (function() {
    if (!self.tmux) return 2;
    try {
      var version = cp.execFileSync('tmux', ['-V'], { encoding: 'utf8' });
      return +/^tmux ([\d.]+)/i.exec(version.trim().split('\n')[0])[1];
    } catch (e) {
      return 2;
    }
  })();

  this._buf = '';
  this._flush = this.flush.bind(this);

  if (options.tput !== false) {
    this.setupTput();
  }

  this.listen();
}

Program.global = null;

Program.total = 0;

Program.instances = [];

Program.bind = function(program) {
  if (!Program.global) {
    Program.global = program;
  }

  if (!~Program.instances.indexOf(program)) {
    Program.instances.push(program);
    program.index = Program.total;
    Program.total++;
  }

  if (Program._bound) return;
  Program._bound = true;

  unshiftEvent(process, 'exit', Program._exitHandler = function() {
    Program.instances.forEach(function(program) {
      // Potentially reset window title on exit:
      // if (program._originalTitle) {
      //   program.setTitle(program._originalTitle);
      // }
      // Ensure the buffer is flushed (it should
      // always be at this point, but who knows).
      program.flush();
      // Ensure _exiting is set (could technically
      // use process._exiting).
      program._exiting = true;
    });
  });
};

Program.prototype.__proto__ = EventEmitter.prototype;

Program.prototype.type = 'program';

Program.prototype.log = function() {
  return this._log('LOG',  util.format.apply(util, arguments));
};

Program.prototype.debug = function() {
  if (!this.options.debug) return;
  return this._log('DEBUG',  util.format.apply(util, arguments));
};

Program.prototype._log = function(pre, msg) {
  if (!this._logger) return;
  return this._logger.write(pre + ': ' + msg + '\n-\n');
};

Program.prototype.setupDump = function() {
  var self = this
    , write = this.output.write
    , decoder = new StringDecoder('utf8');

  function stringify(data) {
    return caret(data
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t'))
      .replace(/[^ -~]/g, function(ch) {
        if (ch.charCodeAt(0) > 0xff) return ch;
        ch = ch.charCodeAt(0).toString(16);
        if (ch.length > 2) {
          if (ch.length < 4) ch = '0' + ch;
          return '\\u' + ch;
        }
        if (ch.length < 2) ch = '0' + ch;
        return '\\x' + ch;
      });
  }

  function caret(data) {
    return data.replace(/[\0\x80\x1b-\x1f\x7f\x01-\x1a]/g, function(ch) {
      switch (ch) {
        case '\0':
        case '\x80':
          ch = '@';
          break;
        case '\x1b':
          ch = '[';
          break;
        case '\x1c':
          ch = '\\';
          break;
        case '\x1d':
          ch = ']';
          break;
        case '\x1e':
          ch = '^';
          break;
        case '\x1f':
          ch = '_';
          break;
        case '\x7f':
          ch = '?';
          break;
        default:
          ch = ch.charCodeAt(0);
          // From ('A' - 64) to ('Z' - 64).
          if (ch >= 1 && ch <= 26) {
            ch = String.fromCharCode(ch + 64);
          } else {
            return String.fromCharCode(ch);
          }
          break;
      }
      return '^' + ch;
    });
  }

  this.input.on('data', function(data) {
    self._log('IN', stringify(decoder.write(data)));
  });

  this.output.write = function(data) {
    self._log('OUT', stringify(data));
    return write.apply(this, arguments);
  };
};

Program.prototype.setupTput = function() {
  if (this._tputSetup) return;
  this._tputSetup = true;

  var self = this
    , options = this.options
    , write = this._write.bind(this);

  var tput = this.tput = new Tput({
    terminal: this.terminal,
    padding: options.padding,
    extended: options.extended,
    printf: options.printf,
    termcap: options.termcap,
    forceUnicode: options.forceUnicode
  });

  if (tput.error) {
    nextTick(function() {
      self.emit('warning', tput.error.message);
    });
  }

  if (tput.padding) {
    nextTick(function() {
      self.emit('warning', 'Terminfo padding has been enabled.');
    });
  }

  this.put = function() {
    var args = slice.call(arguments)
      , cap = args.shift();

    if (tput[cap]) {
      return this._write(tput[cap].apply(tput, args));
    }
  };

  Object.keys(tput).forEach(function(key) {
    if (self[key] == null) {
      self[key] = tput[key];
    }

    if (typeof tput[key] !== 'function') {
      self.put[key] = tput[key];
      return;
    }

    if (tput.padding) {
      self.put[key] = function() {
        return tput._print(tput[key].apply(tput, arguments), write);
      };
    } else {
      self.put[key] = function() {
        return self._write(tput[key].apply(tput, arguments));
      };
    }
  });
};

Program.prototype.__defineGetter__('terminal', function() {
  return this._terminal;
});

Program.prototype.__defineSetter__('terminal', function(terminal) {
  this.setTerminal(terminal);
  return this.terminal;
});

Program.prototype.setTerminal = function(terminal) {
  this._terminal = terminal.toLowerCase();
  delete this._tputSetup;
  this.setupTput();
};

Program.prototype.has = function(name) {
  return this.tput
    ? this.tput.has(name)
    : false;
};

Program.prototype.term = function(is) {
  return this.terminal.indexOf(is) === 0;
};

Program.prototype.listen = function() {
  var self = this;

  // Potentially reset window title on exit:
  // if (!this.isRxvt) {
  //   if (!this.isVTE) this.setTitleModeFeature(3);
  //   this.manipulateWindow(21, function(err, data) {
  //     if (err) return;
  //     self._originalTitle = data.text;
  //   });
  // }

  // Listen for keys/mouse on input
  if (!this.input._blessedInput) {
    this.input._blessedInput = 1;
    this._listenInput();
  } else {
    this.input._blessedInput++;
  }

  this.on('newListener', this._newHandler = function fn(type) {
    if (type === 'keypress' || type === 'mouse') {
      self.removeListener('newListener', fn);
      if (self.input.setRawMode && !self.input.isRaw) {
        self.input.setRawMode(true);
        self.input.resume();
      }
    }
  });

  this.on('newListener', function fn(type) {
    if (type === 'mouse') {
      self.removeListener('newListener', fn);
      self.bindMouse();
    }
  });

  // Listen for resize on output
  if (!this.output._blessedOutput) {
    this.output._blessedOutput = 1;
    this._listenOutput();
  } else {
    this.output._blessedOutput++;
  }
};

Program.prototype._listenInput = function() {
  var keys = require('./keys')
    , self = this;

  // Input
  this.input.on('keypress', this.input._keypressHandler = function(ch, key) {
    key = key || { ch: ch };

    if (key.name === 'undefined'
        && (key.code === '[M' || key.code === '[I' || key.code === '[O')) {
      // A mouse sequence. The `keys` module doesn't understand these.
      return;
    }

    if (key.name === 'undefined') {
      // Not sure what this is, but we should probably ignore it.
      return;
    }

    if (key.name === 'enter' && key.sequence === '\n') {
      key.name = 'linefeed';
    }

    if (key.name === 'return' && key.sequence === '\r') {
      self.input.emit('keypress', ch, merge({}, key, { name: 'enter' }));
    }

    var name = (key.ctrl ? 'C-' : '')
      + (key.meta ? 'M-' : '')
      + (key.shift && key.name ? 'S-' : '')
      + (key.name || ch);

    key.full = name;

    Program.instances.forEach(function(program) {
      if (program.input !== self.input) return;
      program.emit('keypress', ch, key);
      program.emit('key ' + name, ch, key);
    });
  });

  this.input.on('data', this.input._dataHandler = function(data) {
    Program.instances.forEach(function(program) {
      if (program.input !== self.input) return;
      program.emit('data', data);
    });
  });

  keys.emitKeypressEvents(this.input);
};

Program.prototype._listenOutput = function() {
  var self = this;

  if (!this.output.isTTY) {
    nextTick(function() {
      self.emit('warning', 'Output is not a TTY');
    });
  }

  // Output
  function resize() {
    Program.instances.forEach(function(program) {
      if (program.output !== self.output) return;
      program.cols = program.output.columns;
      program.rows = program.output.rows;
      program.emit('resize');
    });
  }

  this.output.on('resize', this.output._resizeHandler = function() {
    Program.instances.forEach(function(program) {
      if (program.output !== self.output) return;
      if (!program.options.resizeTimeout) {
        return resize();
      }
      if (program._resizeTimer) {
        clearTimeout(program._resizeTimer);
        delete program._resizeTimer;
      }
      var time = typeof program.options.resizeTimeout === 'number'
        ? program.options.resizeTimeout
        : 300;
      program._resizeTimer = setTimeout(resize, time);
    });
  });
};

Program.prototype.destroy = function() {
  var index = Program.instances.indexOf(this);

  if (~index) {
    Program.instances.splice(index, 1);
    Program.total--;

    this.flush();
    this._exiting = true;

    Program.global = Program.instances[0];

    if (Program.total === 0) {
      Program.global = null;

      process.removeListener('exit', Program._exitHandler);
      delete Program._exitHandler;

      delete Program._bound;
    }

    this.input._blessedInput--;
    this.output._blessedOutput--;

    if (this.input._blessedInput === 0) {
      this.input.removeListener('keypress', this.input._keypressHandler);
      this.input.removeListener('data', this.input._dataHandler);
      delete this.input._keypressHandler;
      delete this.input._dataHandler;

      if (this.input.setRawMode) {
        if (this.input.isRaw) {
          this.input.setRawMode(false);
        }
        if (!this.input.destroyed) {
          this.input.pause();
        }
      }
    }

    if (this.output._blessedOutput === 0) {
      this.output.removeListener('resize', this.output._resizeHandler);
      delete this.output._resizeHandler;
    }

    this.removeListener('newListener', this._newHandler);
    delete this._newHandler;

    this.destroyed = true;
    this.emit('destroy');
  }
};

Program.prototype.key = function(key, listener) {
  if (typeof key === 'string') key = key.split(/\s*,\s*/);
  key.forEach(function(key) {
    return this.on('key ' + key, listener);
  }, this);
};

Program.prototype.onceKey = function(key, listener) {
  if (typeof key === 'string') key = key.split(/\s*,\s*/);
  key.forEach(function(key) {
    return this.once('key ' + key, listener);
  }, this);
};

Program.prototype.unkey =
Program.prototype.removeKey = function(key, listener) {
  if (typeof key === 'string') key = key.split(/\s*,\s*/);
  key.forEach(function(key) {
    return this.removeListener('key ' + key, listener);
  }, this);
};

// XTerm mouse events
// http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
// To better understand these
// the xterm code is very helpful:
// Relevant files:
//   button.c, charproc.c, misc.c
// Relevant functions in xterm/button.c:
//   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
// send a mouse event:
// regular/utf8: ^[[M Cb Cx Cy
// urxvt: ^[[ Cb ; Cx ; Cy M
// sgr: ^[[ Cb ; Cx ; Cy M/m
// vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
// locator: CSI P e ; P b ; P r ; P c ; P p & w
// motion example of a left click:
// ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
// mouseup, mousedown, mousewheel
// left click: ^[[M 3<^[[M#3<
// mousewheel up: ^[[M`3>
Program.prototype.bindMouse = function() {
  if (this._boundMouse) return;
  this._boundMouse = true;

  var decoder = new StringDecoder('utf8')
    , self = this;

  this.on('data', function(data) {
    var text = decoder.write(data);
    if (!text) return;
    self._bindMouse(text, data);
  });
};

Program.prototype._bindMouse = function(s, buf) {
  var self = this
    , key
    , parts
    , b
    , x
    , y
    , mod
    , params
    , down
    , page
    , button;

  key = {
    name: undefined,
    ctrl: false,
    meta: false,
    shift: false
  };

  if (Buffer.isBuffer(s)) {
    if (s[0] > 127 && s[1] === undefined) {
      s[0] -= 128;
      s = '\x1b' + s.toString('utf-8');
    } else {
      s = s.toString('utf-8');
    }
  }

  // if (this.8bit) {
  //   s = s.replace(/\233/g, '\x1b[');
  //   buf = new Buffer(s, 'utf8');
  // }

  // XTerm / X10 for buggy VTE
  // VTE can only send unsigned chars and no unicode for coords. This limits
  // them to 0xff. However, normally the x10 protocol does not allow a byte
  // under 0x20, but since VTE can have the bytes overflow, we can consider
  // bytes below 0x20 to be up to 0xff + 0x20. This gives a limit of 287. Since
  // characters ranging from 223 to 248 confuse javascript's utf parser, we
  // need to parse the raw binary. We can detect whether the terminal is using
  // a bugged VTE version by examining the coordinates and seeing whether they
  // are a value they would never otherwise be with a properly implemented x10
  // protocol. This method of detecting VTE is only 99% reliable because we
  // can't check if the coords are 0x00 (255) since that is a valid x10 coord
  // technically.
  var bx = s.charCodeAt(4);
  var by = s.charCodeAt(5);
  if (buf[0] === 0x1b && buf[1] === 0x5b && buf[2] === 0x4d
      && (this.isVTE
      || bx >= 65533 || by >= 65533
      || (bx > 0x00 && bx < 0x20)
      || (by > 0x00 && by < 0x20)
      || (buf[4] > 223 && buf[4] < 248 && buf.length === 6)
      || (buf[5] > 223 && buf[5] < 248 && buf.length === 6))) {
    b = buf[3];
    x = buf[4];
    y = buf[5];

    // unsigned char overflow.
    if (x < 0x20) x += 0xff;
    if (y < 0x20) y += 0xff;

    // Convert the coordinates into a
    // properly formatted x10 utf8 sequence.
    s = '\x1b[M'
      + String.fromCharCode(b)
      + String.fromCharCode(x)
      + String.fromCharCode(y);
  }

  // XTerm / X10
  if (parts = /^\x1b\[M([\x00\u0020-\uffff]{3})/.exec(s)) {
    b = parts[1].charCodeAt(0);
    x = parts[1].charCodeAt(1);
    y = parts[1].charCodeAt(2);

    key.name = 'mouse';
    key.type = 'X10';

    key.raw = [b, x, y, parts[0]];
    key.buf = buf;
    key.x = x - 32;
    key.y = y - 32;

    if (this.zero) key.x--, key.y--;

    if (x === 0) key.x = 255;
    if (y === 0) key.y = 255;

    mod = b >> 2;
    key.shift = !!(mod & 1);
    key.meta = !!((mod >> 1) & 1);
    key.ctrl = !!((mod >> 2) & 1);

    b -= 32;

    if ((b >> 6) & 1) {
      key.action = b & 1 ? 'wheeldown' : 'wheelup';
      key.button = 'middle';
    } else if (b === 3) {
      // NOTE: x10 and urxvt have no way
      // of telling which button mouseup used.
      key.action = 'mouseup';
      key.button = this._lastButton || 'unknown';
      delete this._lastButton;
    } else {
      key.action = 'mousedown';
      button = b & 3;
      key.button =
        button === 0 ? 'left'
        : button === 1 ? 'middle'
        : button === 2 ? 'right'
        : 'unknown';
      this._lastButton = key.button;
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // gnome: 32, 36, 48, 40
    // xterm: 35, _, 51, _
    // urxvt: 35, _, _, _
    // if (key.action === 'mousedown' && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43
        || (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button;
      key.action = 'mousemove';
    }

    self.emit('mouse', key);

    return;
  }

  // URxvt
  if (parts = /^\x1b\[(\d+;\d+;\d+)M/.exec(s)) {
    params = parts[1].split(';');
    b = +params[0];
    x = +params[1];
    y = +params[2];

    key.name = 'mouse';
    key.type = 'urxvt';

    key.raw = [b, x, y, parts[0]];
    key.buf = buf;
    key.x = x;
    key.y = y;

    if (this.zero) key.x--, key.y--;

    mod = b >> 2;
    key.shift = !!(mod & 1);
    key.meta = !!((mod >> 1) & 1);
    key.ctrl = !!((mod >> 2) & 1);

    // XXX Bug in urxvt after wheelup/down on mousemove
    // NOTE: This may be different than 128/129 depending
    // on mod keys.
    if (b === 128 || b === 129) {
      b = 67;
    }

    b -= 32;

    if ((b >> 6) & 1) {
      key.action = b & 1 ? 'wheeldown' : 'wheelup';
      key.button = 'middle';
    } else if (b === 3) {
      // NOTE: x10 and urxvt have no way
      // of telling which button mouseup used.
      key.action = 'mouseup';
      key.button = this._lastButton || 'unknown';
      delete this._lastButton;
    } else {
      key.action = 'mousedown';
      button = b & 3;
      key.button =
        button === 0 ? 'left'
        : button === 1 ? 'middle'
        : button === 2 ? 'right'
        : 'unknown';
      // NOTE: 0/32 = mousemove, 32/64 = mousemove with left down
      // if ((b >> 1) === 32)
      this._lastButton = key.button;
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // urxvt: 35, _, _, _
    // gnome: 32, 36, 48, 40
    // if (key.action === 'mousedown' && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43
        || (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button;
      key.action = 'mousemove';
    }

    self.emit('mouse', key);

    return;
  }

  // SGR
  if (parts = /^\x1b\[<(\d+;\d+;\d+)([mM])/.exec(s)) {
    down = parts[2] === 'M';
    params = parts[1].split(';');
    b = +params[0];
    x = +params[1];
    y = +params[2];

    key.name = 'mouse';
    key.type = 'sgr';

    key.raw = [b, x, y, parts[0]];
    key.buf = buf;
    key.x = x;
    key.y = y;

    if (this.zero) key.x--, key.y--;

    mod = b >> 2;
    key.shift = !!(mod & 1);
    key.meta = !!((mod >> 1) & 1);
    key.ctrl = !!((mod >> 2) & 1);

    if ((b >> 6) & 1) {
      key.action = b & 1 ? 'wheeldown' : 'wheelup';
      key.button = 'middle';
    } else {
      key.action = down
        ? 'mousedown'
        : 'mouseup';
      button = b & 3;
      key.button =
        button === 0 ? 'left'
        : button === 1 ? 'middle'
        : button === 2 ? 'right'
        : 'unknown';
    }

    // Probably a movement.
    // The *newer* VTE gets mouse movements comepletely wrong.
    // This presents a problem: older versions of VTE that get it right might
    // be confused by the second conditional in the if statement.
    // NOTE: Possibly just switch back to the if statement below.
    // none, shift, ctrl, alt
    // xterm: 35, _, 51, _
    // gnome: 32, 36, 48, 40
    // if (key.action === 'mousedown' && key.button === 'unknown') {
    if (b === 35 || b === 39 || b === 51 || b === 43
        || (this.isVTE && (b === 32 || b === 36 || b === 48 || b === 40))) {
      delete key.button;
      key.action = 'mousemove';
    }

    self.emit('mouse', key);

    return;
  }

  // DEC
  // The xterm mouse documentation says there is a
  // `<` prefix, the DECRQLP says there is no prefix.
  if (parts = /^\x1b\[<(\d+;\d+;\d+;\d+)&w/.exec(s)) {
    params = parts[1].split(';');
    b = +params[0];
    x = +params[1];
    y = +params[2];
    page = +params[3];

    key.name = 'mouse';
    key.type = 'dec';

    key.raw = [b, x, y, parts[0]];
    key.buf = buf;
    key.x = x;
    key.y = y;
    key.page = page;

    if (this.zero) key.x--, key.y--;

    key.action = b === 3
      ? 'mouseup'
      : 'mousedown';

    key.button =
      b === 2 ? 'left'
      : b === 4 ? 'middle'
      : b === 6 ? 'right'
      : 'unknown';

    self.emit('mouse', key);

    return;
  }

  // vt300
  if (parts = /^\x1b\[24([0135])~\[(\d+),(\d+)\]\r/.exec(s)) {
    b = +parts[1];
    x = +parts[2];
    y = +parts[3];

    key.name = 'mouse';
    key.type = 'vt300';

    key.raw = [b, x, y, parts[0]];
    key.buf = buf;
    key.x = x;
    key.y = y;

    if (this.zero) key.x--, key.y--;

    key.action = 'mousedown';
    key.button =
      b === 1 ? 'left'
      : b === 2 ? 'middle'
      : b === 5 ? 'right'
      : 'unknown';

    self.emit('mouse', key);

    return;
  }

  if (parts = /^\x1b\[(O|I)/.exec(s)) {
    key.action = parts[1] === 'I'
      ? 'focus'
      : 'blur';

    self.emit('mouse', key);
    self.emit(key.action);

    return;
  }
};

// gpm support for linux vc
Program.prototype.enableGpm = function() {
  var self = this;
  var gpmclient = require('./gpmclient');

  if (this.gpm) return;

  this.gpm = gpmclient();

  this.gpm.on('btndown', function(btn, modifier, x, y) {
    x--, y--;

    var key = {
      name: 'mouse',
      type: 'GPM',
      action: 'mousedown',
      button: self.gpm.ButtonName(btn),
      raw: [btn, modifier, x, y],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    };

    self.emit('mouse', key);
  });

  this.gpm.on('btnup', function(btn, modifier, x, y) {
    x--, y--;

    var key = {
      name: 'mouse',
      type: 'GPM',
      action: 'mouseup',
      button: self.gpm.ButtonName(btn),
      raw: [btn, modifier, x, y],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    };

    self.emit('mouse', key);
  });

  this.gpm.on('move', function(btn, modifier, x, y) {
    x--, y--;

    var key = {
      name: 'mouse',
      type: 'GPM',
      action: 'mousemove',
      button: self.gpm.ButtonName(btn),
      raw: [btn, modifier, x, y],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    };

    self.emit('mouse', key);
  });

  this.gpm.on('drag', function(btn, modifier, x, y) {
    x--, y--;

    var key = {
      name: 'mouse',
      type: 'GPM',
      action: 'mousemove',
      button: self.gpm.ButtonName(btn),
      raw: [btn, modifier, x, y],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    };

    self.emit('mouse', key);
  });

  this.gpm.on('mousewheel', function(btn, modifier, x, y, dx, dy) {
    var key = {
      name: 'mouse',
      type: 'GPM',
      action: dy > 0 ? 'wheelup' : 'wheeldown',
      button: self.gpm.ButtonName(btn),
      raw: [btn, modifier, x, y, dx, dy],
      x: x,
      y: y,
      shift: self.gpm.hasShiftKey(modifier),
      meta: self.gpm.hasMetaKey(modifier),
      ctrl: self.gpm.hasCtrlKey(modifier)
    };

    self.emit('mouse', key);
  });
};

Program.prototype.disableGpm = function() {
  if (this.gpm) {
    this.gpm.stop();
    delete this.gpm;
  }
};

// All possible responses from the terminal
Program.prototype.bindResponse = function() {
  if (this._boundResponse) return;
  this._boundResponse = true;

  var decoder = new StringDecoder('utf8')
    , self = this;

  this.on('data', function(data) {
    data = decoder.write(data);
    if (!data) return;
    self._bindResponse(data);
  });
};

Program.prototype._bindResponse = function(s) {
  var out = {}
    , parts;

  if (Buffer.isBuffer(s)) {
    if (s[0] > 127 && s[1] === undefined) {
      s[0] -= 128;
      s = '\x1b' + s.toString('utf-8');
    } else {
      s = s.toString('utf-8');
    }
  }

  // CSI P s c
  // Send Device Attributes (Primary DA).
  // CSI > P s c
  // Send Device Attributes (Secondary DA).
  if (parts = /^\x1b\[(\?|>)(\d*(?:;\d*)*)c/.exec(s)) {
    parts = parts[2].split(';').map(function(ch) {
      return +ch || 0;
    });

    out.event = 'device-attributes';
    out.code = 'DA';

    if (parts[1] === '?') {
      out.type = 'primary-attribute';
      // VT100-style params:
      if (parts[0] === 1 && parts[2] === 2) {
        out.term = 'vt100';
        out.advancedVideo = true;
      } else if (parts[0] === 1 && parts[2] === 0) {
        out.term = 'vt101';
      } else if (parts[0] === 6) {
        out.term = 'vt102';
      } else if (parts[0] === 60
        && parts[1] === 1 && parts[2] === 2
        && parts[3] === 6 && parts[4] === 8
        && parts[5] === 9 && parts[6] === 15) {
        out.term = 'vt220';
      } else {
        // VT200-style params:
        parts.forEach(function(attr) {
          switch (attr) {
            case 1:
              out.cols132 = true;
              break;
            case 2:
              out.printer = true;
              break;
            case 6:
              out.selectiveErase = true;
              break;
            case 8:
              out.userDefinedKeys = true;
              break;
            case 9:
              out.nationalReplacementCharsets = true;
              break;
            case 15:
              out.technicalCharacters = true;
              break;
            case 18:
              out.userWindows = true;
              break;
            case 21:
              out.horizontalScrolling = true;
              break;
            case 22:
              out.ansiColor = true;
              break;
            case 29:
              out.ansiTextLocator = true;
              break;
          }
        });
      }
    } else {
      out.type = 'secondary-attribute';
      switch (parts[0]) {
        case 0:
          out.term = 'vt100';
          break;
        case 1:
          out.term = 'vt220';
          break;
        case 2:
          out.term = 'vt240';
          break;
        case 18:
          out.term = 'vt330';
          break;
        case 19:
          out.term = 'vt340';
          break;
        case 24:
          out.term = 'vt320';
          break;
        case 41:
          out.term = 'vt420';
          break;
        case 61:
          out.term = 'vt510';
          break;
        case 64:
          out.term = 'vt520';
          break;
        case 65:
          out.term = 'vt525';
          break;
      }
      out.firmwareVersion = parts[1];
      out.romCartridgeRegistrationNumber = parts[2];
    }

    // LEGACY
    out.deviceAttributes = out;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // CSI Ps n  Device Status Report (DSR).
  //     Ps = 5  -> Status Report.  Result (``OK'') is
  //   CSI 0 n
  // CSI ? Ps n
  //   Device Status Report (DSR, DEC-specific).
  //     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
  //     or CSI ? 1 1  n  (not ready).
  //     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
  //     or CSI ? 2 1  n  (locked).
  //     Ps = 2 6  -> Report Keyboard status as
  //   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
  //   The last two parameters apply to VT400 & up, and denote key-
  //   board ready and LK01 respectively.
  //     Ps = 5 3  -> Report Locator status as
  //   CSI ? 5 3  n  Locator available, if compiled-in, or
  //   CSI ? 5 0  n  No Locator, if not.
  if (parts = /^\x1b\[(\?)?(\d+)(?:;(\d+);(\d+);(\d+))?n/.exec(s)) {
    out.event = 'device-status';
    out.code = 'DSR';

    if (!parts[1] && parts[2] === '0' && !parts[3]) {
      out.type = 'device-status';
      out.status = 'OK';

      // LEGACY
      out.deviceStatus = out.status;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] && (parts[2] === '10' || parts[2] === '11') && !parts[3]) {
      out.type = 'printer-status';
      out.status = parts[2] === '10'
        ? 'ready'
        : 'not ready';

      // LEGACY
      out.printerStatus = out.status;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] && (parts[2] === '20' || parts[2] === '21') && !parts[3]) {
      out.type = 'udk-status';
      out.status = parts[2] === '20'
        ? 'unlocked'
        : 'locked';

      // LEGACY
      out.UDKStatus = out.status;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1]
        && parts[2] === '27'
        && parts[3] === '1'
        && parts[4] === '0'
        && parts[5] === '0') {
      out.type = 'keyboard-status';
      out.status = 'OK';

      // LEGACY
      out.keyboardStatus = out.status;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] && (parts[2] === '53' || parts[2] === '50') && !parts[3]) {
      out.type = 'locator-status';
      out.status = parts[2] === '53'
          ? 'available'
          : 'unavailable';

      // LEGACY
      out.locator = out.status;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    out.type = 'error';
    out.text = 'Unhandled: ' + JSON.stringify(parts);

    // LEGACY
    out.error = out.text;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // CSI Ps n  Device Status Report (DSR).
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column].
  //   Result is
  //   CSI r ; c R
  // CSI ? Ps n
  //   Device Status Report (DSR, DEC-specific).
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
  //     ? r ; c R (assumes page is zero).
  if (parts = /^\x1b\[(\?)?(\d+);(\d+)R/.exec(s)) {
    out.event = 'device-status';
    out.code = 'DSR';
    out.type = 'cursor-status';

    out.status = {
      x: +parts[3],
      y: +parts[2],
      page: !parts[1] ? undefined : 0
    };

    out.x = out.status.x;
    out.y = out.status.y;
    out.page = out.status.page;

    // LEGACY
    out.cursor = out.status;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // CSI Ps ; Ps ; Ps t
  //   Window manipulation (from dtterm, as well as extensions).
  //   These controls may be disabled using the allowWindowOps
  //   resource.  Valid values for the first (and any additional
  //   parameters) are:
  //     Ps = 1 1  -> Report xterm window state.  If the xterm window
  //     is open (non-iconified), it returns CSI 1 t .  If the xterm
  //     window is iconified, it returns CSI 2 t .
  //     Ps = 1 3  -> Report xterm window position.  Result is CSI 3
  //     ; x ; y t
  //     Ps = 1 4  -> Report xterm window in pixels.  Result is CSI
  //     4  ;  height ;  width t
  //     Ps = 1 8  -> Report the size of the text area in characters.
  //     Result is CSI  8  ;  height ;  width t
  //     Ps = 1 9  -> Report the size of the screen in characters.
  //     Result is CSI  9  ;  height ;  width t
  if (parts = /^\x1b\[(\d+)(?:;(\d+);(\d+))?t/.exec(s)) {
    out.event = 'window-manipulation';
    out.code = '';

    if ((parts[1] === '1' || parts[1] === '2') && !parts[2]) {
      out.type = 'window-state';
      out.state = parts[1] === '1'
        ? 'non-iconified'
        : 'iconified';

      // LEGACY
      out.windowState = out.state;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] === '3' && parts[2]) {
      out.type = 'window-position';

      out.position = {
        x: +parts[2],
        y: +parts[3]
      };
      out.x = out.position.x;
      out.y = out.position.y;

      // LEGACY
      out.windowPosition = out.position;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] === '4' && parts[2]) {
      out.type = 'window-size-pixels';
      out.size = {
        height: +parts[2],
        width: +parts[3]
      };
      out.height = out.size.height;
      out.width = out.size.width;

      // LEGACY
      out.windowSizePixels = out.size;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] === '8' && parts[2]) {
      out.type = 'textarea-size';
      out.size = {
        height: +parts[2],
        width: +parts[3]
      };
      out.height = out.size.height;
      out.width = out.size.width;

      // LEGACY
      out.textAreaSizeCharacters = out.size;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] === '9' && parts[2]) {
      out.type = 'screen-size';
      out.size = {
        height: +parts[2],
        width: +parts[3]
      };
      out.height = out.size.height;
      out.width = out.size.width;

      // LEGACY
      out.screenSizeCharacters = out.size;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    out.type = 'error';
    out.text = 'Unhandled: ' + JSON.stringify(parts);

    // LEGACY
    out.error = out.text;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // rxvt-unicode does not support window manipulation
  //   Result Normal: OSC l/L 0xEF 0xBF 0xBD
  //   Result ASCII: OSC l/L 0x1c (file separator)
  //   Result UTF8->ASCII: OSC l/L 0xFD
  // Test with:
  //   echo -ne '\ePtmux;\e\e[>3t\e\\'
  //   sleep 2 && echo -ne '\ePtmux;\e\e[21t\e\\' & cat -v
  //   -
  //   echo -ne '\e[>3t'
  //   sleep 2 && echo -ne '\e[21t' & cat -v
  if (parts = /^\x1b\](l|L)([^\x07\x1b]*)$/.exec(s)) {
    parts[2] = 'rxvt';
    s = '\x1b]' + parts[1] + parts[2] + '\x1b\\';
  }

  // CSI Ps ; Ps ; Ps t
  //   Window manipulation (from dtterm, as well as extensions).
  //   These controls may be disabled using the allowWindowOps
  //   resource.  Valid values for the first (and any additional
  //   parameters) are:
  //     Ps = 2 0  -> Report xterm window's icon label.  Result is
  //     OSC  L  label ST
  //     Ps = 2 1  -> Report xterm window's title.  Result is OSC  l
  //     label ST
  if (parts = /^\x1b\](l|L)([^\x07\x1b]*)(?:\x07|\x1b\\)/.exec(s)) {
    out.event = 'window-manipulation';
    out.code = '';

    if (parts[1] === 'L') {
      out.type = 'window-icon-label';
      out.text = parts[2];

      // LEGACY
      out.windowIconLabel = out.text;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    if (parts[1] === 'l') {
      out.type = 'window-title';
      out.text = parts[2];

      // LEGACY
      out.windowTitle = out.text;

      this.emit('response', out);
      this.emit('response ' + out.event, out);

      return;
    }

    out.type = 'error';
    out.text = 'Unhandled: ' + JSON.stringify(parts);

    // LEGACY
    out.error = out.text;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // CSI Ps ' |
  //   Request Locator Position (DECRQLP).
  //     -> CSI Pe ; Pb ; Pr ; Pc ; Pp &  w
  //   Parameters are [event;button;row;column;page].
  //   Valid values for the event:
  //     Pe = 0  -> locator unavailable - no other parameters sent.
  //     Pe = 1  -> request - xterm received a DECRQLP.
  //     Pe = 2  -> left button down.
  //     Pe = 3  -> left button up.
  //     Pe = 4  -> middle button down.
  //     Pe = 5  -> middle button up.
  //     Pe = 6  -> right button down.
  //     Pe = 7  -> right button up.
  //     Pe = 8  -> M4 button down.
  //     Pe = 9  -> M4 button up.
  //     Pe = 1 0  -> locator outside filter rectangle.
  //   ``button'' parameter is a bitmask indicating which buttons are
  //     pressed:
  //     Pb = 0  <- no buttons down.
  //     Pb & 1  <- right button down.
  //     Pb & 2  <- middle button down.
  //     Pb & 4  <- left button down.
  //     Pb & 8  <- M4 button down.
  //   ``row'' and ``column'' parameters are the coordinates of the
  //     locator position in the xterm window, encoded as ASCII deci-
  //     mal.
  //   The ``page'' parameter is not used by xterm, and will be omit-
  //   ted.
  // NOTE:
  // This is already implemented in the _bindMouse
  // method, but it might make more sense here.
  // The xterm mouse documentation says there is a
  // `<` prefix, the DECRQLP says there is no prefix.
  if (parts = /^\x1b\[(\d+(?:;\d+){4})&w/.exec(s)) {
    parts = parts[1].split(';').map(function(ch) {
      return +ch;
    });

    out.event = 'locator-position';
    out.code = 'DECRQLP';

    switch (parts[0]) {
      case 0:
        out.status = 'locator-unavailable';
        break;
      case 1:
        out.status = 'request';
        break;
      case 2:
        out.status = 'left-button-down';
        break;
      case 3:
        out.status = 'left-button-up';
        break;
      case 4:
        out.status = 'middle-button-down';
        break;
      case 5:
        out.status = 'middle-button-up';
        break;
      case 6:
        out.status = 'right-button-down';
        break;
      case 7:
        out.status = 'right-button-up';
        break;
      case 8:
        out.status = 'm4-button-down';
        break;
      case 9:
        out.status = 'm4-button-up';
        break;
      case 10:
        out.status = 'locator-outside';
        break;
    }

    out.mask = parts[1];
    out.row = parts[2];
    out.col = parts[3];
    out.page = parts[4];

    // LEGACY
    out.locatorPosition = out;

    this.emit('response', out);
    this.emit('response ' + out.event, out);

    return;
  }

  // OSC Ps ; Pt BEL
  // OSC Ps ; Pt ST
  // Set Text Parameters
  if (parts = /^\x1b\](\d+);([^\x07\x1b]+)(?:\x07|\x1b\\)/.exec(s)) {
    out.event = 'text-params';
    out.code = 'Set Text Parameters';
    out.ps = +s[1];
    out.pt = s[2];
    this.emit('response', out);
    this.emit('response ' + out.event, out);
  }
};

Program.prototype.response = function(name, text, callback, noBypass) {
  var self = this;

  if (arguments.length === 2) {
    callback = text;
    text = name;
    name = null;
  }

  if (!callback) {
    callback = function() {};
  }

  this.bindResponse();

  name = name
    ? 'response ' + name
    : 'response';

  var onresponse;

  this.once(name, onresponse = function(event) {
    if (timeout) clearTimeout(timeout);
    if (event.type === 'error') {
      return callback(new Error(event.event + ': ' + event.text));
    }
    return callback(null, event);
  });

  var timeout = setTimeout(function() {
    self.removeListener(name, onresponse);
    return callback(new Error('Timeout.'));
  }, 2000);

  return noBypass
    ? this._write(text)
    : this._twrite(text);
};

Program.prototype._owrite =
Program.prototype.write = function(text) {
  if (!this.output.writable) return;
  return this.output.write(text);
};

Program.prototype._buffer = function(text) {
  if (this._exiting) {
    this.flush();
    this._owrite(text);
    return;
  }

  if (this._buf) {
    this._buf += text;
    return;
  }

  this._buf = text;

  nextTick(this._flush);

  return true;
};

Program.prototype.flush = function() {
  if (!this._buf) return;
  this._owrite(this._buf);
  this._buf = '';
};

Program.prototype._write = function(text) {
  if (this.ret) return text;
  if (this.useBuffer) {
    return this._buffer(text);
  }
  return this._owrite(text);
};

// Example: `DCS tmux; ESC Pt ST`
// Real: `DCS tmux; ESC Pt ESC \`
Program.prototype._twrite = function(data) {
  var self = this
    , iterations = 0
    , timer;

  if (this.tmux) {
    // Replace all STs with BELs so they can be nested within the DCS code.
    data = data.replace(/\x1b\\/g, '\x07');

    // Wrap in tmux forward DCS:
    data = '\x1bPtmux;\x1b' + data + '\x1b\\';

    // If we've never even flushed yet, it means we're still in
    // the normal buffer. Wait for alt screen buffer.
    if (this.output.bytesWritten === 0) {
      timer = setInterval(function() {
        if (self.output.bytesWritten > 0 || ++iterations === 50) {
          clearInterval(timer);
          self.flush();
          self._owrite(data);
        }
      }, 100);
      return true;
    }

    // NOTE: Flushing the buffer is required in some cases.
    // The DCS code must be at the start of the output.
    this.flush();

    // Write out raw now that the buffer is flushed.
    return this._owrite(data);
  }

  return this._write(data);
};

Program.prototype.echo =
Program.prototype.print = function(text, attr) {
  return attr
    ? this._write(this.text(text, attr))
    : this._write(text);
};

Program.prototype._ncoords = function() {
  if (this.x < 0) this.x = 0;
  else if (this.x >= this.cols) this.x = this.cols - 1;
  if (this.y < 0) this.y = 0;
  else if (this.y >= this.rows) this.y = this.rows - 1;
};

Program.prototype.setx = function(x) {
  return this.cursorCharAbsolute(x);
  // return this.charPosAbsolute(x);
};

Program.prototype.sety = function(y) {
  return this.linePosAbsolute(y);
};

Program.prototype.move = function(x, y) {
  return this.cursorPos(y, x);
};

// TODO: Fix cud and cuu calls.
Program.prototype.omove = function(x, y) {
  if (!this.zero) {
    x = (x || 1) - 1;
    y = (y || 1) - 1;
  } else {
    x = x || 0;
    y = y || 0;
  }
  if (y === this.y && x === this.x) {
    return;
  }
  if (y === this.y) {
    if (x > this.x) {
      this.cuf(x - this.x);
    } else if (x < this.x) {
      this.cub(this.x - x);
    }
  } else if (x === this.x) {
    if (y > this.y) {
      this.cud(y - this.y);
    } else if (y < this.y) {
      this.cuu(this.y - y);
    }
  } else {
    if (!this.zero) x++, y++;
    this.cup(y, x);
  }
};

Program.prototype.rsetx = function(x) {
  // return this.HPositionRelative(x);
  if (!x) return;
  return x > 0
    ? this.forward(x)
    : this.back(-x);
};

Program.prototype.rsety = function(y) {
  // return this.VPositionRelative(y);
  if (!y) return;
  return y > 0
    ? this.up(y)
    : this.down(-y);
};

Program.prototype.rmove = function(x, y) {
  this.rsetx(x);
  this.rsety(y);
};

Program.prototype.simpleInsert = function(ch, i, attr) {
  return this._write(this.repeat(ch, i), attr);
};

Program.prototype.repeat = function(ch, i) {
  if (!i || i < 0) i = 0;
  return Array(i + 1).join(ch);
};

Program.prototype.__defineGetter__('title', function() {
  return this._title;
});

Program.prototype.__defineSetter__('title', function(title) {
  this.setTitle(title);
  return this._title;
});

// Specific to iTerm2, but I think it's really cool.
// Example:
//  if (!screen.copyToClipboard(text)) {
//    execClipboardProgram(text);
//  }
Program.prototype.copyToClipboard = function(text) {
  if (this.isiTerm2) {
    this._twrite('\x1b]50;CopyToCliboard=' + text + '\x07');
    return true;
  }
  return false;
};

// Only XTerm and iTerm2. If you know of any others, post them.
Program.prototype.cursorShape = function(shape, blink) {
  if (this.isiTerm2) {
    switch (shape) {
      case 'block':
        if (!blink) {
          this._twrite('\x1b]50;CursorShape=0;BlinkingCursorEnabled=0\x07');
        } else {
          this._twrite('\x1b]50;CursorShape=0;BlinkingCursorEnabled=1\x07');
        }
        break;
      case 'underline':
        if (!blink) {
          // this._twrite('\x1b]50;CursorShape=n;BlinkingCursorEnabled=0\x07');
        } else {
          // this._twrite('\x1b]50;CursorShape=n;BlinkingCursorEnabled=1\x07');
        }
        break;
      case 'line':
        if (!blink) {
          this._twrite('\x1b]50;CursorShape=1;BlinkingCursorEnabled=0\x07');
        } else {
          this._twrite('\x1b]50;CursorShape=1;BlinkingCursorEnabled=1\x07');
        }
        break;
    }
    return true;
  } else if (this.term('xterm') || this.term('screen')) {
    switch (shape) {
      case 'block':
        if (!blink) {
          this._twrite('\x1b[0 q');
        } else {
          this._twrite('\x1b[1 q');
        }
        break;
      case 'underline':
        if (!blink) {
          this._twrite('\x1b[2 q');
        } else {
          this._twrite('\x1b[3 q');
        }
        break;
      case 'line':
        if (!blink) {
          this._twrite('\x1b[4 q');
        } else {
          this._twrite('\x1b[5 q');
        }
        break;
    }
    return true;
  }
  return false;
};

Program.prototype.cursorColor = function(color) {
  if (this.term('xterm') || this.term('rxvt') || this.term('screen')) {
    this._twrite('\x1b]12;' + color + '\x07');
    return true;
  }
  return false;
};

Program.prototype.cursorReset =
Program.prototype.resetCursor = function() {
  if (this.term('xterm') || this.term('rxvt') || this.term('screen')) {
    // XXX
    // return this.resetColors();
    this._twrite('\x1b[0 q');
    this._twrite('\x1b]112\x07');
    // urxvt doesnt support OSC 112
    this._twrite('\x1b]12;white\x07');
    return true;
  }
  return false;
};

Program.prototype.getTextParams = function(param, callback) {
  return this.response('text-params', '\x1b]' + param + ';?\x07', function(err, data) {
    if (err) return callback(err);
    return callback(null, data.pt);
  });
};

Program.prototype.getCursorColor = function(callback) {
  return this.getTextParams(12, callback);
};

/**
 * Normal
 */

//Program.prototype.pad =
Program.prototype.nul = function() {
  //if (this.has('pad')) return this.put.pad();
  return this._write('\x80');
};

Program.prototype.bel =
Program.prototype.bell = function() {
  if (this.has('bel')) return this.put.bel();
  return this._write('\x07');
};

Program.prototype.vtab = function() {
  this.y++;
  this._ncoords();
  return this._write('\x0b');
};

Program.prototype.ff =
Program.prototype.form = function() {
  if (this.has('ff')) return this.put.ff();
  return this._write('\x0c');
};

Program.prototype.kbs =
Program.prototype.backspace = function() {
  this.x--;
  this._ncoords();
  if (this.has('kbs')) return this.put.kbs();
  return this._write('\x08');
};

Program.prototype.ht =
Program.prototype.tab = function() {
  this.x += 8;
  this._ncoords();
  if (this.has('ht')) return this.put.ht();
  return this._write('\t');
};

Program.prototype.shiftOut = function() {
  // if (this.has('S2')) return this.put.S2();
  return this._write('\x0e');
};

Program.prototype.shiftIn = function() {
  // if (this.has('S3')) return this.put.S3();
  return this._write('\x0f');
};

Program.prototype.cr =
Program.prototype.return = function() {
  this.x = 0;
  if (this.has('cr')) return this.put.cr();
  return this._write('\r');
};

Program.prototype.nel =
Program.prototype.newline =
Program.prototype.feed = function() {
  if (this.tput && this.tput.bools.eat_newline_glitch && this.x >= this.cols) {
    return;
  }
  this.x = 0;
  this.y++;
  this._ncoords();
  if (this.has('nel')) return this.put.nel();
  return this._write('\n');
};

/**
 * Esc
 */

// ESC D Index (IND is 0x84).
Program.prototype.ind =
Program.prototype.index = function() {
  this.y++;
  this._ncoords();
  if (this.tput) return this.put.ind();
  return this._write('\x1bD');
};

// ESC M Reverse Index (RI is 0x8d).
Program.prototype.ri =
Program.prototype.reverse =
Program.prototype.reverseIndex = function() {
  this.y--;
  this._ncoords();
  if (this.tput) return this.put.ri();
  return this._write('\x1bM');
};

// ESC E Next Line (NEL is 0x85).
Program.prototype.nextLine = function() {
  this.y++;
  this.x = 0;
  this._ncoords();
  if (this.has('nel')) return this.put.nel();
  return this._write('\x1bE');
};

// ESC c Full Reset (RIS).
Program.prototype.reset = function() {
  this.x = this.y = 0;
  if (this.has('rs1') || this.has('ris')) {
    return this.has('rs1')
      ? this.put.rs1()
      : this.put.ris();
  }
  return this._write('\x1bc');
};

// ESC H Tab Set (HTS is 0x88).
Program.prototype.tabSet = function() {
  if (this.tput) return this.put.hts();
  return this._write('\x1bH');
};

// ESC 7 Save Cursor (DECSC).
Program.prototype.sc =
Program.prototype.saveCursor = function(key) {
  if (key) return this.lsaveCursor(key);
  this.savedX = this.x || 0;
  this.savedY = this.y || 0;
  if (this.tput) return this.put.sc();
  return this._write('\x1b7');
};

// ESC 8 Restore Cursor (DECRC).
Program.prototype.rc =
Program.prototype.restoreCursor = function(key, hide) {
  if (key) return this.lrestoreCursor(key, hide);
  this.x = this.savedX || 0;
  this.y = this.savedY || 0;
  if (this.tput) return this.put.rc();
  return this._write('\x1b8');
};

// Save Cursor Locally
Program.prototype.lsaveCursor = function(key) {
  key = key || 'local';
  this._saved = this._saved || {};
  this._saved[key] = this._saved[key] || {};
  this._saved[key].x = this.x;
  this._saved[key].y = this.y;
  this._saved[key].hidden = this.cursorHidden;
};

// Restore Cursor Locally
Program.prototype.lrestoreCursor = function(key, hide) {
  var pos;
  key = key || 'local';
  if (!this._saved || !this._saved[key]) return;
  pos = this._saved[key];
  //delete this._saved[key];
  this.cup(pos.y, pos.x);
  if (hide && pos.hidden !== this.cursorHidden) {
    if (pos.hidden) {
      this.hideCursor();
    } else {
      this.showCursor();
    }
  }
};

// ESC # 3 DEC line height/width
Program.prototype.lineHeight = function() {
  return this._write('\x1b#');
};

// ESC (,),*,+,-,. Designate G0-G2 Character Set.
Program.prototype.charset = function(val, level) {
  level = level || 0;

  // See also:
  // acs_chars / acsc / ac
  // enter_alt_charset_mode / smacs / as
  // exit_alt_charset_mode / rmacs / ae
  // enter_pc_charset_mode / smpch / S2
  // exit_pc_charset_mode / rmpch / S3

  switch (level) {
    case 0:
      level = '(';
      break;
    case 1:
      level = ')';
      break;
    case 2:
      level = '*';
      break;
    case 3:
      level = '+';
      break;
  }

  var name = typeof val === 'string'
    ? val.toLowerCase()
    : val;

  switch (name) {
    case 'acs':
    case 'scld': // DEC Special Character and Line Drawing Set.
      if (this.tput) return this.put.smacs();
      val = '0';
      break;
    case 'uk': // UK
      val = 'A';
      break;
    case 'us': // United States (USASCII).
    case 'usascii':
    case 'ascii':
      if (this.tput) return this.put.rmacs();
      val = 'B';
      break;
    case 'dutch': // Dutch
      val = '4';
      break;
    case 'finnish': // Finnish
      val = 'C';
      val = '5';
      break;
    case 'french': // French
      val = 'R';
      break;
    case 'frenchcanadian': // FrenchCanadian
      val = 'Q';
      break;
    case 'german':  // German
      val = 'K';
      break;
    case 'italian': // Italian
      val = 'Y';
      break;
    case 'norwegiandanish': // NorwegianDanish
      val = 'E';
      val = '6';
      break;
    case 'spanish': // Spanish
      val = 'Z';
      break;
    case 'swedish': // Swedish
      val = 'H';
      val = '7';
      break;
    case 'swiss': // Swiss
      val = '=';
      break;
    case 'isolatin': // ISOLatin (actually /A)
      val = '/A';
      break;
    default: // Default
      if (this.tput) return this.put.rmacs();
      val = 'B';
      break;
  }

  return this._write('\x1b(' + val);
};

Program.prototype.enter_alt_charset_mode =
Program.prototype.as =
Program.prototype.smacs = function() {
  return this.charset('acs');
};

Program.prototype.exit_alt_charset_mode =
Program.prototype.ae =
Program.prototype.rmacs = function() {
  return this.charset('ascii');
};

// ESC N
// Single Shift Select of G2 Character Set
// ( SS2 is 0x8e). This affects next character only.
// ESC O
// Single Shift Select of G3 Character Set
// ( SS3 is 0x8f). This affects next character only.
// ESC n
// Invoke the G2 Character Set as GL (LS2).
// ESC o
// Invoke the G3 Character Set as GL (LS3).
// ESC |
// Invoke the G3 Character Set as GR (LS3R).
// ESC }
// Invoke the G2 Character Set as GR (LS2R).
// ESC ~
// Invoke the G1 Character Set as GR (LS1R).
Program.prototype.setG = function(val) {
  // if (this.tput) return this.put.S2();
  // if (this.tput) return this.put.S3();
  switch (val) {
    case 1:
      val = '~'; // GR
      break;
    case 2:
      val = 'n'; // GL
      val = '}'; // GR
      val = 'N'; // Next Char Only
      break;
    case 3:
      val = 'o'; // GL
      val = '|'; // GR
      val = 'O'; // Next Char Only
      break;
  }
  return this._write('\x1b' + val);
};

/**
 * OSC
 */

// OSC Ps ; Pt ST
// OSC Ps ; Pt BEL
//   Set Text Parameters.
Program.prototype.setTitle = function(title) {
  this._title = title;

  // if (this.term('screen')) {
  //   // Tmux pane
  //   // if (this.tmux) {
  //   //   return this._write('\x1b]2;' + title + '\x1b\\');
  //   // }
  //   return this._write('\x1bk' + title + '\x1b\\');
  // }

  return this._twrite('\x1b]0;' + title + '\x07');
};

// OSC Ps ; Pt ST
// OSC Ps ; Pt BEL
//   Reset colors
Program.prototype.resetColors = function(param) {
  if (this.has('Cr')) {
    return this.put.Cr(param);
  }
  return this._twrite('\x1b]112\x07');
  //return this._twrite('\x1b]112;' + param + '\x07');
};

// OSC Ps ; Pt ST
// OSC Ps ; Pt BEL
//   Change dynamic colors
Program.prototype.dynamicColors = function(param) {
  if (this.has('Cs')) {
    return this.put.Cs(param);
  }
  return this._twrite('\x1b]12;' + param + '\x07');
};

// OSC Ps ; Pt ST
// OSC Ps ; Pt BEL
//   Sel data
Program.prototype.selData = function(a, b) {
  if (this.has('Ms')) {
    return this.put.Ms(a, b);
  }
  return this._twrite('\x1b]52;' + a + ';' + b + '\x07');
};

/**
 * CSI
 */

// CSI Ps A
// Cursor Up Ps Times (default = 1) (CUU).
Program.prototype.cuu =
Program.prototype.up =
Program.prototype.cursorUp = function(param) {
  this.y -= param || 1;
  this._ncoords();
  if (this.tput) {
    if (!this.tput.strings.parm_up_cursor) {
      return this._write(this.repeat(this.tput.cuu1(), param));
    }
    return this.put.cuu(param);
  }
  return this._write('\x1b[' + (param || '') + 'A');
};

// CSI Ps B
// Cursor Down Ps Times (default = 1) (CUD).
Program.prototype.cud =
Program.prototype.down =
Program.prototype.cursorDown = function(param) {
  this.y += param || 1;
  this._ncoords();
  if (this.tput) {
    if (!this.tput.strings.parm_down_cursor) {
      return this._write(this.repeat(this.tput.cud1(), param));
    }
    return this.put.cud(param);
  }
  return this._write('\x1b[' + (param || '') + 'B');
};

// CSI Ps C
// Cursor Forward Ps Times (default = 1) (CUF).
Program.prototype.cuf =
Program.prototype.right =
Program.prototype.forward =
Program.prototype.cursorForward = function(param) {
  this.x += param || 1;
  this._ncoords();
  if (this.tput) {
    if (!this.tput.strings.parm_right_cursor) {
      return this._write(this.repeat(this.tput.cuf1(), param));
    }
    return this.put.cuf(param);
  }
  return this._write('\x1b[' + (param || '') + 'C');
};

// CSI Ps D
// Cursor Backward Ps Times (default = 1) (CUB).
Program.prototype.cub =
Program.prototype.left =
Program.prototype.back =
Program.prototype.cursorBackward = function(param) {
  this.x -= param || 1;
  this._ncoords();
  if (this.tput) {
    if (!this.tput.strings.parm_left_cursor) {
      return this._write(this.repeat(this.tput.cub1(), param));
    }
    return this.put.cub(param);
  }
  return this._write('\x1b[' + (param || '') + 'D');
};

// CSI Ps ; Ps H
// Cursor Position [row;column] (default = [1,1]) (CUP).
Program.prototype.cup =
Program.prototype.pos =
Program.prototype.cursorPos = function(row, col) {
  if (!this.zero) {
    row = (row || 1) - 1;
    col = (col || 1) - 1;
  } else {
    row = row || 0;
    col = col || 0;
  }
  this.x = col;
  this.y = row;
  this._ncoords();
  if (this.tput) return this.put.cup(row, col);
  return this._write('\x1b[' + (row + 1) + ';' + (col + 1) + 'H');
};

// CSI Ps J  Erase in Display (ED).
//     Ps = 0  -> Erase Below (default).
//     Ps = 1  -> Erase Above.
//     Ps = 2  -> Erase All.
//     Ps = 3  -> Erase Saved Lines (xterm).
// CSI ? Ps J
//   Erase in Display (DECSED).
//     Ps = 0  -> Selective Erase Below (default).
//     Ps = 1  -> Selective Erase Above.
//     Ps = 2  -> Selective Erase All.
Program.prototype.ed =
Program.prototype.eraseInDisplay = function(param) {
  if (this.tput) {
    switch (param) {
      case 'above':
        param = 1;
        break;
      case 'all':
        param = 2;
        break;
      case 'saved':
        param = 3;
        break;
      case 'below':
      default:
        param = 0;
        break;
    }
    // extended tput.E3 = ^[[3;J
    return this.put.ed(param);
  }
  switch (param) {
    case 'above':
      return this._write('\X1b[1J');
    case 'all':
      return this._write('\x1b[2J');
    case 'saved':
      return this._write('\x1b[3J');
    case 'below':
    default:
      return this._write('\x1b[J');
  }
};

Program.prototype.clear = function() {
  this.x = 0;
  this.y = 0;
  if (this.tput) return this.put.clear();
  return this._write('\x1b[H\x1b[J');
};

// CSI Ps K  Erase in Line (EL).
//     Ps = 0  -> Erase to Right (default).
//     Ps = 1  -> Erase to Left.
//     Ps = 2  -> Erase All.
// CSI ? Ps K
//   Erase in Line (DECSEL).
//     Ps = 0  -> Selective Erase to Right (default).
//     Ps = 1  -> Selective Erase to Left.
//     Ps = 2  -> Selective Erase All.
Program.prototype.el =
Program.prototype.eraseInLine = function(param) {
  if (this.tput) {
    //if (this.tput.back_color_erase) ...
    switch (param) {
      case 'left':
        param = 1;
        break;
      case 'all':
        param = 2;
        break;
      case 'right':
      default:
        param = 0;
        break;
    }
    return this.put.el(param);
  }
  switch (param) {
    case 'left':
      return this._write('\x1b[1K');
    case 'all':
      return this._write('\x1b[2K');
    case 'right':
    default:
      return this._write('\x1b[K');
  }
};

// CSI Pm m  Character Attributes (SGR).
//     Ps = 0  -> Normal (default).
//     Ps = 1  -> Bold.
//     Ps = 4  -> Underlined.
//     Ps = 5  -> Blink (appears as Bold).
//     Ps = 7  -> Inverse.
//     Ps = 8  -> Invisible, i.e., hidden (VT300).
//     Ps = 2 2  -> Normal (neither bold nor faint).
//     Ps = 2 4  -> Not underlined.
//     Ps = 2 5  -> Steady (not blinking).
//     Ps = 2 7  -> Positive (not inverse).
//     Ps = 2 8  -> Visible, i.e., not hidden (VT300).
//     Ps = 3 0  -> Set foreground color to Black.
//     Ps = 3 1  -> Set foreground color to Red.
//     Ps = 3 2  -> Set foreground color to Green.
//     Ps = 3 3  -> Set foreground color to Yellow.
//     Ps = 3 4  -> Set foreground color to Blue.
//     Ps = 3 5  -> Set foreground color to Magenta.
//     Ps = 3 6  -> Set foreground color to Cyan.
//     Ps = 3 7  -> Set foreground color to White.
//     Ps = 3 9  -> Set foreground color to default (original).
//     Ps = 4 0  -> Set background color to Black.
//     Ps = 4 1  -> Set background color to Red.
//     Ps = 4 2  -> Set background color to Green.
//     Ps = 4 3  -> Set background color to Yellow.
//     Ps = 4 4  -> Set background color to Blue.
//     Ps = 4 5  -> Set background color to Magenta.
//     Ps = 4 6  -> Set background color to Cyan.
//     Ps = 4 7  -> Set background color to White.
//     Ps = 4 9  -> Set background color to default (original).

//   If 16-color support is compiled, the following apply.  Assume
//   that xterm's resources are set so that the ISO color codes are
//   the first 8 of a set of 16.  Then the aixterm colors are the
//   bright versions of the ISO colors:
//     Ps = 9 0  -> Set foreground color to Black.
//     Ps = 9 1  -> Set foreground color to Red.
//     Ps = 9 2  -> Set foreground color to Green.
//     Ps = 9 3  -> Set foreground color to Yellow.
//     Ps = 9 4  -> Set foreground color to Blue.
//     Ps = 9 5  -> Set foreground color to Magenta.
//     Ps = 9 6  -> Set foreground color to Cyan.
//     Ps = 9 7  -> Set foreground color to White.
//     Ps = 1 0 0  -> Set background color to Black.
//     Ps = 1 0 1  -> Set background color to Red.
//     Ps = 1 0 2  -> Set background color to Green.
//     Ps = 1 0 3  -> Set background color to Yellow.
//     Ps = 1 0 4  -> Set background color to Blue.
//     Ps = 1 0 5  -> Set background color to Magenta.
//     Ps = 1 0 6  -> Set background color to Cyan.
//     Ps = 1 0 7  -> Set background color to White.

//   If xterm is compiled with the 16-color support disabled, it
//   supports the following, from rxvt:
//     Ps = 1 0 0  -> Set foreground and background color to
//     default.

//   If 88- or 256-color support is compiled, the following apply.
//     Ps = 3 8  ; 5  ; Ps -> Set foreground color to the second
//     Ps.
//     Ps = 4 8  ; 5  ; Ps -> Set background color to the second
//     Ps.
Program.prototype.sgr =
Program.prototype.attr =
Program.prototype.charAttributes = function(param, val) {
  return this._write(this._attr(param, val));
};

Program.prototype.text = function(text, attr) {
  return this._attr(attr, true) + text + this._attr(attr, false);
};

// NOTE: sun-color may not allow multiple params for SGR.
Program.prototype._attr = function(param, val) {
  var self = this
    , parts
    , color
    , m;

  if (Array.isArray(param)) {
    parts = param;
    param = parts[0] || 'normal';
  } else {
    param = param || 'normal';
    parts = param.split(/\s*[,;]\s*/);
  }

  if (parts.length > 1) {
    var used = {}
      , out = [];

    parts.forEach(function(part) {
      var attr = self._attr(part, val);
      if (attr == null) return;
      part = attr.slice(2, -1);
      if (part === '') return;
      if (used[part]) return;
      used[part] = true;
      out.push(part);
    });

    return '\x1b[' + out.join(';') + 'm';
  }

  if (param.indexOf('no ') === 0) {
    param = param.substring(3);
    val = false;
  } else if (param.indexOf('!') === 0) {
    param = param.substring(1);
    val = false;
  }

  switch (param) {
    // attributes
    case 'normal':
    case 'default':
      if (val === false) return '';
      return '\x1b[m';
    case 'bold':
      return val === false
        ? '\x1b[22m'
        : '\x1b[1m';
    case 'ul':
    case 'underline':
    case 'underlined':
      return val === false
        ? '\x1b[24m'
        : '\x1b[4m';
    case 'blink':
      return val === false
        ? '\x1b[25m'
        : '\x1b[5m';
    case 'inverse':
      return val === false
        ? '\x1b[27m'
        : '\x1b[7m';
    case 'invisible':
      return val === false
        ? '\x1b[28m'
        : '\x1b[8m';

    // 8-color foreground
    case 'black fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[30m';
    case 'red fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[31m';
    case 'green fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[32m';
    case 'yellow fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[33m';
    case 'blue fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[34m';
    case 'magenta fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[35m';
    case 'cyan fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[36m';
    case 'white fg':
    case 'light grey fg':
    case 'light gray fg':
    case 'bright grey fg':
    case 'bright gray fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[37m';
    case 'default fg':
      if (val === false) return '';
      return '\x1b[39m';

    // 8-color background
    case 'black bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[40m';
    case 'red bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[41m';
    case 'green bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[42m';
    case 'yellow bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[43m';
    case 'blue bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[44m';
    case 'magenta bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[45m';
    case 'cyan bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[46m';
    case 'white bg':
    case 'light grey bg':
    case 'light gray bg':
    case 'bright grey bg':
    case 'bright gray bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[47m';
    case 'default bg':
      if (val === false) return '';
      return '\x1b[49m';

    // 16-color foreground
    case 'light black fg':
    case 'bright black fg':
    case 'grey fg':
    case 'gray fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[90m';
    case 'light red fg':
    case 'bright red fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[91m';
    case 'light green fg':
    case 'bright green fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[92m';
    case 'light yellow fg':
    case 'bright yellow fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[93m';
    case 'light blue fg':
    case 'bright blue fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[94m';
    case 'light magenta fg':
    case 'bright magenta fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[95m';
    case 'light cyan fg':
    case 'bright cyan fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[96m';
    case 'light white fg':
    case 'bright white fg':
      return val === false
        ? '\x1b[39m'
        : '\x1b[97m';

    // 16-color background
    case 'light black bg':
    case 'bright black bg':
    case 'grey bg':
    case 'gray bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[100m';
    case 'light red bg':
    case 'bright red bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[101m';
    case 'light green bg':
    case 'bright green bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[102m';
    case 'light yellow bg':
    case 'bright yellow bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[103m';
    case 'light blue bg':
    case 'bright blue bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[104m';
    case 'light magenta bg':
    case 'bright magenta bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[105m';
    case 'light cyan bg':
    case 'bright cyan bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[106m';
    case 'light white bg':
    case 'bright white bg':
      return val === false
        ? '\x1b[49m'
        : '\x1b[107m';

    // non-16-color rxvt default fg and bg
    case 'default fg bg':
      if (val === false) return '';
      return this.term('rxvt')
        ? '\x1b[100m'
        : '\x1b[39;49m';

    default:
      // 256-color fg and bg
      if (param[0] === '#') {
        param = param.replace(/#(?:[0-9a-f]{3}){1,2}/i, colors.match);
      }

      m = /^(-?\d+) (fg|bg)$/.exec(param);
      if (m) {
        color = +m[1];

        if (val === false || color === -1) {
          return this._attr('default ' + m[2]);
        }

        color = colors.reduce(color, this.tput.colors);

        if (color < 16 || (this.tput && this.tput.colors <= 16)) {
          if (m[2] === 'fg') {
            if (color < 8) {
              color += 30;
            } else if (color < 16) {
              color -= 8;
              color += 90;
            }
          } else if (m[2] === 'bg') {
            if (color < 8) {
              color += 40;
            } else if (color < 16) {
              color -= 8;
              color += 100;
            }
          }
          return '\x1b[' + color + 'm';
        }

        if (m[2] === 'fg') {
          return '\x1b[38;5;' + color + 'm';
        }

        if (m[2] === 'bg') {
          return '\x1b[48;5;' + color + 'm';
        }
      }

      if (/^[\d;]*$/.test(param)) {
        return '\x1b[' + param + 'm';
      }

      return null;
  }
};

Program.prototype.fg =
Program.prototype.setForeground = function(color, val) {
  color = color.split(/\s*[,;]\s*/).join(' fg, ') + ' fg';
  return this.attr(color, val);
};

Program.prototype.bg =
Program.prototype.setBackground = function(color, val) {
  color = color.split(/\s*[,;]\s*/).join(' bg, ') + ' bg';
  return this.attr(color, val);
};

// CSI Ps n  Device Status Report (DSR).
//     Ps = 5  -> Status Report.  Result (``OK'') is
//   CSI 0 n
//     Ps = 6  -> Report Cursor Position (CPR) [row;column].
//   Result is
//   CSI r ; c R
// CSI ? Ps n
//   Device Status Report (DSR, DEC-specific).
//     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
//     ? r ; c R (assumes page is zero).
//     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
//     or CSI ? 1 1  n  (not ready).
//     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
//     or CSI ? 2 1  n  (locked).
//     Ps = 2 6  -> Report Keyboard status as
//   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
//   The last two parameters apply to VT400 & up, and denote key-
//   board ready and LK01 respectively.
//     Ps = 5 3  -> Report Locator status as
//   CSI ? 5 3  n  Locator available, if compiled-in, or
//   CSI ? 5 0  n  No Locator, if not.
Program.prototype.dsr =
Program.prototype.deviceStatus = function(param, callback, dec, noBypass) {
  if (dec) {
    return this.response('device-status',
      '\x1b[?' + (param || '0') + 'n', callback, noBypass);
  }
  return this.response('device-status',
    '\x1b[' + (param || '0') + 'n', callback, noBypass);
};

Program.prototype.getCursor = function(callback) {
  return this.deviceStatus(6, callback, false, true);
};

Program.prototype.saveReportedCursor = function(callback) {
  var self = this;
  if (this.tput.strings.user7 === '\x1b[6n' || this.term('screen')) {
    return this.getCursor(function(err, data) {
      if (data) {
        self._rx = data.status.x;
        self._ry = data.status.y;
      }
      if (!callback) return;
      return callback(err);
    });
  }
  if (!callback) return;
  return callback();
};

Program.prototype.restoreReportedCursor = function() {
  if (this._rx == null) return;
  return this.cup(this._ry, this._rx);
  // return this.nel();
};

/**
 * Additions
 */

// CSI Ps @
// Insert Ps (Blank) Character(s) (default = 1) (ICH).
Program.prototype.ich =
Program.prototype.insertChars = function(param) {
  this.x += param || 1;
  this._ncoords();
  if (this.tput) return this.put.ich(param);
  return this._write('\x1b[' + (param || 1) + '@');
};

// CSI Ps E
// Cursor Next Line Ps Times (default = 1) (CNL).
// same as CSI Ps B ?
Program.prototype.cnl =
Program.prototype.cursorNextLine = function(param) {
  this.y += param || 1;
  this._ncoords();
  return this._write('\x1b[' + (param || '') + 'E');
};

// CSI Ps F
// Cursor Preceding Line Ps Times (default = 1) (CNL).
// reuse CSI Ps A ?
Program.prototype.cpl =
Program.prototype.cursorPrecedingLine = function(param) {
  this.y -= param || 1;
  this._ncoords();
  return this._write('\x1b[' + (param || '') + 'F');
};

// CSI Ps G
// Cursor Character Absolute  [column] (default = [row,1]) (CHA).
Program.prototype.cha =
Program.prototype.cursorCharAbsolute = function(param) {
  if (!this.zero) {
    param = (param || 1) - 1;
  } else {
    param = param || 0;
  }
  this.x = param;
  this.y = 0;
  this._ncoords();
  if (this.tput) return this.put.hpa(param);
  return this._write('\x1b[' + (param + 1) + 'G');
};

// CSI Ps L
// Insert Ps Line(s) (default = 1) (IL).
Program.prototype.il =
Program.prototype.insertLines = function(param) {
  if (this.tput) return this.put.il(param);
  return this._write('\x1b[' + (param || '') + 'L');
};

// CSI Ps M
// Delete Ps Line(s) (default = 1) (DL).
Program.prototype.dl =
Program.prototype.deleteLines = function(param) {
  if (this.tput) return this.put.dl(param);
  return this._write('\x1b[' + (param || '') + 'M');
};

// CSI Ps P
// Delete Ps Character(s) (default = 1) (DCH).
Program.prototype.dch =
Program.prototype.deleteChars = function(param) {
  if (this.tput) return this.put.dch(param);
  return this._write('\x1b[' + (param || '') + 'P');
};

// CSI Ps X
// Erase Ps Character(s) (default = 1) (ECH).
Program.prototype.ech =
Program.prototype.eraseChars = function(param) {
  if (this.tput) return this.put.ech(param);
  return this._write('\x1b[' + (param || '') + 'X');
};

// CSI Pm `  Character Position Absolute
//   [column] (default = [row,1]) (HPA).
Program.prototype.hpa =
Program.prototype.charPosAbsolute = function(param) {
  this.x = param || 0;
  this._ncoords();
  if (this.tput) {
    return this.put.hpa.apply(this.put, arguments);
  }
  param = slice.call(arguments).join(';');
  return this._write('\x1b[' + (param || '') + '`');
};

// 141 61 a * HPR -
// Horizontal Position Relative
// reuse CSI Ps C ?
Program.prototype.hpr =
Program.prototype.HPositionRelative = function(param) {
  if (this.tput) return this.cuf(param);
  this.x += param || 1;
  this._ncoords();
  // Does not exist:
  // if (this.tput) return this.put.hpr(param);
  return this._write('\x1b[' + (param || '') + 'a');
};

// CSI Ps c  Send Device Attributes (Primary DA).
//     Ps = 0  or omitted -> request attributes from terminal.  The
//     response depends on the decTerminalID resource setting.
//     -> CSI ? 1 ; 2 c  (``VT100 with Advanced Video Option'')
//     -> CSI ? 1 ; 0 c  (``VT101 with No Options'')
//     -> CSI ? 6 c  (``VT102'')
//     -> CSI ? 6 0 ; 1 ; 2 ; 6 ; 8 ; 9 ; 1 5 ; c  (``VT220'')
//   The VT100-style response parameters do not mean anything by
//   themselves.  VT220 parameters do, telling the host what fea-
//   tures the terminal supports:
//     Ps = 1  -> 132-columns.
//     Ps = 2  -> Printer.
//     Ps = 6  -> Selective erase.
//     Ps = 8  -> User-defined keys.
//     Ps = 9  -> National replacement character sets.
//     Ps = 1 5  -> Technical characters.
//     Ps = 2 2  -> ANSI color, e.g., VT525.
//     Ps = 2 9  -> ANSI text locator (i.e., DEC Locator mode).
// CSI > Ps c
//   Send Device Attributes (Secondary DA).
//     Ps = 0  or omitted -> request the terminal's identification
//     code.  The response depends on the decTerminalID resource set-
//     ting.  It should apply only to VT220 and up, but xterm extends
//     this to VT100.
//     -> CSI  > Pp ; Pv ; Pc c
//   where Pp denotes the terminal type
//     Pp = 0  -> ``VT100''.
//     Pp = 1  -> ``VT220''.
//   and Pv is the firmware version (for xterm, this was originally
//   the XFree86 patch number, starting with 95).  In a DEC termi-
//   nal, Pc indicates the ROM cartridge registration number and is
//   always zero.
// More information:
//   xterm/charproc.c - line 2012, for more information.
//   vim responds with ^[[?0c or ^[[?1c after the terminal's response (?)
Program.prototype.da =
Program.prototype.sendDeviceAttributes = function(param, callback) {
  return this.response('device-attributes',
    '\x1b[' + (param || '') + 'c', callback);
};

// CSI Pm d
// Line Position Absolute  [row] (default = [1,column]) (VPA).
// NOTE: Can't find in terminfo, no idea why it has multiple params.
Program.prototype.vpa =
Program.prototype.linePosAbsolute = function(param) {
  this.y = param || 1;
  this._ncoords();
  if (this.tput) {
    return this.put.vpa.apply(this.put, arguments);
  }
  param = slice.call(arguments).join(';');
  return this._write('\x1b[' + (param || '') + 'd');
};

// 145 65 e * VPR - Vertical Position Relative
// reuse CSI Ps B ?
Program.prototype.vpr =
Program.prototype.VPositionRelative = function(param) {
  if (this.tput) return this.cud(param);
  this.y += param || 1;
  this._ncoords();
  // Does not exist:
  // if (this.tput) return this.put.vpr(param);
  return this._write('\x1b[' + (param || '') + 'e');
};

// CSI Ps ; Ps f
//   Horizontal and Vertical Position [row;column] (default =
//   [1,1]) (HVP).
Program.prototype.hvp =
Program.prototype.HVPosition = function(row, col) {
  if (!this.zero) {
    row = (row || 1) - 1;
    col = (col || 1) - 1;
  } else {
    row = row || 0;
    col = col || 0;
  }
  this.y = row;
  this.x = col;
  this._ncoords();
  // Does not exist (?):
  // if (this.tput) return this.put.hvp(row, col);
  if (this.tput) return this.put.cup(row, col);
  return this._write('\x1b[' + (row + 1) + ';' + (col + 1) + 'f');
};

// CSI Pm h  Set Mode (SM).
//     Ps = 2  -> Keyboard Action Mode (AM).
//     Ps = 4  -> Insert Mode (IRM).
//     Ps = 1 2  -> Send/receive (SRM).
//     Ps = 2 0  -> Automatic Newline (LNM).
// CSI ? Pm h
//   DEC Private Mode Set (DECSET).
//     Ps = 1  -> Application Cursor Keys (DECCKM).
//     Ps = 2  -> Designate USASCII for character sets G0-G3
//     (DECANM), and set VT100 mode.
//     Ps = 3  -> 132 Column Mode (DECCOLM).
//     Ps = 4  -> Smooth (Slow) Scroll (DECSCLM).
//     Ps = 5  -> Reverse Video (DECSCNM).
//     Ps = 6  -> Origin Mode (DECOM).
//     Ps = 7  -> Wraparound Mode (DECAWM).
//     Ps = 8  -> Auto-repeat Keys (DECARM).
//     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
//     tion Mouse Tracking.
//     Ps = 1 0  -> Show toolbar (rxvt).
//     Ps = 1 2  -> Start Blinking Cursor (att610).
//     Ps = 1 8  -> Print form feed (DECPFF).
//     Ps = 1 9  -> Set print extent to full screen (DECPEX).
//     Ps = 2 5  -> Show Cursor (DECTCEM).
//     Ps = 3 0  -> Show scrollbar (rxvt).
//     Ps = 3 5  -> Enable font-shifting functions (rxvt).
//     Ps = 3 8  -> Enter Tektronix Mode (DECTEK).
//     Ps = 4 0  -> Allow 80 -> 132 Mode.
//     Ps = 4 1  -> more(1) fix (see curses resource).
//     Ps = 4 2  -> Enable Nation Replacement Character sets (DECN-
//     RCM).
//     Ps = 4 4  -> Turn On Margin Bell.
//     Ps = 4 5  -> Reverse-wraparound Mode.
//     Ps = 4 6  -> Start Logging.  This is normally disabled by a
//     compile-time option.
//     Ps = 4 7  -> Use Alternate Screen Buffer.  (This may be dis-
//     abled by the titeInhibit resource).
//     Ps = 6 6  -> Application keypad (DECNKM).
//     Ps = 6 7  -> Backarrow key sends backspace (DECBKM).
//     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
//     release.  See the section Mouse Tracking.
//     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
//     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
//     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
//     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
//     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
//     Ps = 1 0 1 0  -> Scroll to bottom on tty output (rxvt).
//     Ps = 1 0 1 1  -> Scroll to bottom on key press (rxvt).
//     Ps = 1 0 3 4  -> Interpret "meta" key, sets eighth bit.
//     (enables the eightBitInput resource).
//     Ps = 1 0 3 5  -> Enable special modifiers for Alt and Num-
//     Lock keys.  (This enables the numLock resource).
//     Ps = 1 0 3 6  -> Send ESC   when Meta modifies a key.  (This
//     enables the metaSendsEscape resource).
//     Ps = 1 0 3 7  -> Send DEL from the editing-keypad Delete
//     key.
//     Ps = 1 0 3 9  -> Send ESC  when Alt modifies a key.  (This
//     enables the altSendsEscape resource).
//     Ps = 1 0 4 0  -> Keep selection even if not highlighted.
//     (This enables the keepSelection resource).
//     Ps = 1 0 4 1  -> Use the CLIPBOARD selection.  (This enables
//     the selectToClipboard resource).
//     Ps = 1 0 4 2  -> Enable Urgency window manager hint when
//     Control-G is received.  (This enables the bellIsUrgent
//     resource).
//     Ps = 1 0 4 3  -> Enable raising of the window when Control-G
//     is received.  (enables the popOnBell resource).
//     Ps = 1 0 4 7  -> Use Alternate Screen Buffer.  (This may be
//     disabled by the titeInhibit resource).
//     Ps = 1 0 4 8  -> Save cursor as in DECSC.  (This may be dis-
//     abled by the titeInhibit resource).
//     Ps = 1 0 4 9  -> Save cursor as in DECSC and use Alternate
//     Screen Buffer, clearing it first.  (This may be disabled by
//     the titeInhibit resource).  This combines the effects of the 1
//     0 4 7  and 1 0 4 8  modes.  Use this with terminfo-based
//     applications rather than the 4 7  mode.
//     Ps = 1 0 5 0  -> Set terminfo/termcap function-key mode.
//     Ps = 1 0 5 1  -> Set Sun function-key mode.
//     Ps = 1 0 5 2  -> Set HP function-key mode.
//     Ps = 1 0 5 3  -> Set SCO function-key mode.
//     Ps = 1 0 6 0  -> Set legacy keyboard emulation (X11R6).
//     Ps = 1 0 6 1  -> Set VT220 keyboard emulation.
//     Ps = 2 0 0 4  -> Set bracketed paste mode.
// Modes:
//   http://vt100.net/docs/vt220-rm/chapter4.html
Program.prototype.sm =
Program.prototype.setMode = function() {
  var param = slice.call(arguments).join(';');
  return this._write('\x1b[' + (param || '') + 'h');
};

Program.prototype.decset = function() {
  var param = slice.call(arguments).join(';');
  return this.setMode('?' + param);
};

Program.prototype.dectcem =
Program.prototype.cnorm =
Program.prototype.cvvis =
Program.prototype.showCursor = function() {
  this.cursorHidden = false;
  // NOTE: In xterm terminfo:
  // cnorm stops blinking cursor
  // cvvis starts blinking cursor
  if (this.tput) return this.put.cnorm();
  //if (this.tput) return this.put.cvvis();
  // return this._write('\x1b[?12l\x1b[?25h'); // cursor_normal
  // return this._write('\x1b[?12;25h'); // cursor_visible
  return this.setMode('?25');
};

Program.prototype.alternate =
Program.prototype.smcup =
Program.prototype.alternateBuffer = function() {
  this.isAlt = true;
  if (this.tput) return this.put.smcup();
  if (this.term('vt') || this.term('linux')) return;
  this.setMode('?47');
  return this.setMode('?1049');
};

// CSI Pm l  Reset Mode (RM).
//     Ps = 2  -> Keyboard Action Mode (AM).
//     Ps = 4  -> Replace Mode (IRM).
//     Ps = 1 2  -> Send/receive (SRM).
//     Ps = 2 0  -> Normal Linefeed (LNM).
// CSI ? Pm l
//   DEC Private Mode Reset (DECRST).
//     Ps = 1  -> Normal Cursor Keys (DECCKM).
//     Ps = 2  -> Designate VT52 mode (DECANM).
//     Ps = 3  -> 80 Column Mode (DECCOLM).
//     Ps = 4  -> Jump (Fast) Scroll (DECSCLM).
//     Ps = 5  -> Normal Video (DECSCNM).
//     Ps = 6  -> Normal Cursor Mode (DECOM).
//     Ps = 7  -> No Wraparound Mode (DECAWM).
//     Ps = 8  -> No Auto-repeat Keys (DECARM).
//     Ps = 9  -> Don't send Mouse X & Y on button press.
//     Ps = 1 0  -> Hide toolbar (rxvt).
//     Ps = 1 2  -> Stop Blinking Cursor (att610).
//     Ps = 1 8  -> Don't print form feed (DECPFF).
//     Ps = 1 9  -> Limit print to scrolling region (DECPEX).
//     Ps = 2 5  -> Hide Cursor (DECTCEM).
//     Ps = 3 0  -> Don't show scrollbar (rxvt).
//     Ps = 3 5  -> Disable font-shifting functions (rxvt).
//     Ps = 4 0  -> Disallow 80 -> 132 Mode.
//     Ps = 4 1  -> No more(1) fix (see curses resource).
//     Ps = 4 2  -> Disable Nation Replacement Character sets (DEC-
//     NRCM).
//     Ps = 4 4  -> Turn Off Margin Bell.
//     Ps = 4 5  -> No Reverse-wraparound Mode.
//     Ps = 4 6  -> Stop Logging.  (This is normally disabled by a
//     compile-time option).
//     Ps = 4 7  -> Use Normal Screen Buffer.
//     Ps = 6 6  -> Numeric keypad (DECNKM).
//     Ps = 6 7  -> Backarrow key sends delete (DECBKM).
//     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
//     release.  See the section Mouse Tracking.
//     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
//     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
//     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
//     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
//     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
//     Ps = 1 0 1 0  -> Don't scroll to bottom on tty output
//     (rxvt).
//     Ps = 1 0 1 1  -> Don't scroll to bottom on key press (rxvt).
//     Ps = 1 0 3 4  -> Don't interpret "meta" key.  (This disables
//     the eightBitInput resource).
//     Ps = 1 0 3 5  -> Disable special modifiers for Alt and Num-
//     Lock keys.  (This disables the numLock resource).
//     Ps = 1 0 3 6  -> Don't send ESC  when Meta modifies a key.
//     (This disables the metaSendsEscape resource).
//     Ps = 1 0 3 7  -> Send VT220 Remove from the editing-keypad
//     Delete key.
//     Ps = 1 0 3 9  -> Don't send ESC  when Alt modifies a key.
//     (This disables the altSendsEscape resource).
//     Ps = 1 0 4 0  -> Do not keep selection when not highlighted.
//     (This disables the keepSelection resource).
//     Ps = 1 0 4 1  -> Use the PRIMARY selection.  (This disables
//     the selectToClipboard resource).
//     Ps = 1 0 4 2  -> Disable Urgency window manager hint when
//     Control-G is received.  (This disables the bellIsUrgent
//     resource).
//     Ps = 1 0 4 3  -> Disable raising of the window when Control-
//     G is received.  (This disables the popOnBell resource).
//     Ps = 1 0 4 7  -> Use Normal Screen Buffer, clearing screen
//     first if in the Alternate Screen.  (This may be disabled by
//     the titeInhibit resource).
//     Ps = 1 0 4 8  -> Restore cursor as in DECRC.  (This may be
//     disabled by the titeInhibit resource).
//     Ps = 1 0 4 9  -> Use Normal Screen Buffer and restore cursor
//     as in DECRC.  (This may be disabled by the titeInhibit
//     resource).  This combines the effects of the 1 0 4 7  and 1 0
//     4 8  modes.  Use this with terminfo-based applications rather
//     than the 4 7  mode.
//     Ps = 1 0 5 0  -> Reset terminfo/termcap function-key mode.
//     Ps = 1 0 5 1  -> Reset Sun function-key mode.
//     Ps = 1 0 5 2  -> Reset HP function-key mode.
//     Ps = 1 0 5 3  -> Reset SCO function-key mode.
//     Ps = 1 0 6 0  -> Reset legacy keyboard emulation (X11R6).
//     Ps = 1 0 6 1  -> Reset keyboard emulation to Sun/PC style.
//     Ps = 2 0 0 4  -> Reset bracketed paste mode.
Program.prototype.rm =
Program.prototype.resetMode = function() {
  var param = slice.call(arguments).join(';');
  return this._write('\x1b[' + (param || '') + 'l');
};

Program.prototype.decrst = function() {
  var param = slice.call(arguments).join(';');
  return this.resetMode('?' + param);
};

Program.prototype.dectcemh =
Program.prototype.cursor_invisible =
Program.prototype.vi =
Program.prototype.civis =
Program.prototype.hideCursor = function() {
  this.cursorHidden = true;
  if (this.tput) return this.put.civis();
  return this.resetMode('?25');
};

Program.prototype.rmcup =
Program.prototype.normalBuffer = function() {
  this.isAlt = false;
  if (this.tput) return this.put.rmcup();
  this.resetMode('?47');
  return this.resetMode('?1049');
};

Program.prototype.enableMouse = function() {
  if (process.env.BLESSED_FORCE_MODES) {
    var modes = process.env.BLESSED_FORCE_MODES.split(',');
    var options = {};
    for (var n = 0; n < modes.length; ++n) {
      var pair = modes[n].split('=');
      var v = pair[1] !== '0';
      switch (pair[0].toUpperCase()) {
        case 'SGRMOUSE':
          options.sgrMouse = v;
          break;
        case 'UTFMOUSE':
          options.utfMouse = v;
          break;
        case 'VT200MOUSE':
          options.vt200Mouse = v;
          break;
        case 'URXVTMOUSE':
          options.urxvtMouse = v;
          break;
        case 'X10MOUSE':
          options.x10Mouse = v;
          break;
        case 'DECMOUSE':
          options.decMouse = v;
          break;
        case 'PTERMMOUSE':
          options.ptermMouse = v;
          break;
        case 'JSBTERMMOUSE':
          options.jsbtermMouse = v;
          break;
        case 'VT200HILITE':
          options.vt200Hilite = v;
          break;
        case 'GPMMOUSE':
          options.gpmMouse = v;
          break;
        case 'CELLMOTION':
          options.cellMotion = v;
          break;
        case 'ALLMOTION':
          options.allMotion = v;
          break;
        case 'SENDFOCUS':
          options.sendFocus = v;
          break;
      }
    }
    return this.setMouse(options, true);
  }

  // NOTE:
  // Cell Motion isn't normally need for anything below here, but we'll
  // activate it for tmux (whether using it or not) in case our all-motion
  // passthrough does not work. It can't hurt.

  if (this.term('rxvt-unicode')) {
    return this.setMouse({
      urxvtMouse: true,
      cellMotion: true,
      allMotion: true
    }, true);
  }

  // rxvt does not support the X10 UTF extensions
  if (this.term('rxvt')) {
    return this.setMouse({
      vt200Mouse: true,
      x10Mouse: true,
      cellMotion: true,
      allMotion: true
    }, true);
  }

  // libvte is broken. Older versions do not support the
  // X10 UTF extension. However, later versions do support
  // SGR/URXVT.
  if (this.isVTE) {
    return this.setMouse({
      // NOTE: Could also use urxvtMouse here.
      sgrMouse: true,
      cellMotion: true,
      allMotion: true
    }, true);
  }

  if (this.term('linux')) {
    return this.setMouse({
      vt200Mouse: true,
      gpmMouse: true
    }, true);
  }

  if (this.term('xterm')
      || this.term('screen')
      || (this.tput && this.tput.strings.key_mouse)) {
    return this.setMouse({
      vt200Mouse: true,
      utfMouse: true,
      cellMotion: true,
      allMotion: true
    }, true);
  }
};

Program.prototype.disableMouse = function() {
  if (!this._currentMouse) return;

  var obj = {};

  Object.keys(this._currentMouse).forEach(function(key) {
    obj[key] = false;
  });

  return this.setMouse(obj, false);
};

// Set Mouse
Program.prototype.setMouse = function(opt, enable) {
  if (opt.normalMouse != null) {
    opt.vt200Mouse = opt.normalMouse;
    opt.allMotion = opt.normalMouse;
  }

  if (opt.hiliteTracking != null) {
    opt.vt200Hilite = opt.hiliteTracking;
  }

  if (enable === true) {
    if (this._currentMouse) {
      this.setMouse(opt);
      Object.keys(opt).forEach(function(key) {
        this._currentMouse[key] = opt[key];
      }, this);
      return;
    }
    this._currentMouse = opt;
    this.mouseEnabled = true;
  } else if (enable === false) {
    delete this._currentMouse;
    this.mouseEnabled = false;
  }

  //     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
  //     tion Mouse Tracking.
  //     Ps = 9  -> Don't send Mouse X & Y on button press.
  // x10 mouse
  if (opt.x10Mouse != null) {
    if (opt.x10Mouse) this.setMode('?9');
    else this.resetMode('?9');
  }

  //     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  //     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  // vt200 mouse
  if (opt.vt200Mouse != null) {
    if (opt.vt200Mouse) this.setMode('?1000');
    else this.resetMode('?1000');
  }

  //     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
  //     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
  if (opt.vt200Hilite != null) {
    if (opt.vt200Hilite) this.setMode('?1001');
    else this.resetMode('?1001');
  }

  //     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
  //     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
  // button event mouse
  if (opt.cellMotion != null) {
    if (opt.cellMotion) this.setMode('?1002');
    else this.resetMode('?1002');
  }

  //     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
  //     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
  // any event mouse
  if (opt.allMotion != null) {
    // NOTE: Latest versions of tmux seem to only support cellMotion (not
    // allMotion). We pass all motion through to the terminal.
    if (this.tmux && this.tmuxVersion >= 2) {
      if (opt.allMotion) this._twrite('\x1b[?1003h');
      else this._twrite('\x1b[?1003l');
    } else {
      if (opt.allMotion) this.setMode('?1003');
      else this.resetMode('?1003');
    }
  }

  //     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
  //     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
  if (opt.sendFocus != null) {
    if (opt.sendFocus) this.setMode('?1004');
    else this.resetMode('?1004');
  }

  //     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
  //     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
  if (opt.utfMouse != null) {
    if (opt.utfMouse) this.setMode('?1005');
    else this.resetMode('?1005');
  }

  // sgr mouse
  if (opt.sgrMouse != null) {
    if (opt.sgrMouse) this.setMode('?1006');
    else this.resetMode('?1006');
  }

  // urxvt mouse
  if (opt.urxvtMouse != null) {
    if (opt.urxvtMouse) this.setMode('?1015');
    else this.resetMode('?1015');
  }

  // dec mouse
  if (opt.decMouse != null) {
    if (opt.decMouse) this._write('\x1b[1;2\'z\x1b[1;3\'{');
    else this._write('\x1b[\'z');
  }

  // pterm mouse
  if (opt.ptermMouse != null) {
    if (opt.ptermMouse) this._write('\x1b[>1h\x1b[>6h\x1b[>7h\x1b[>1h\x1b[>9l');
    else this._write('\x1b[>1l\x1b[>6l\x1b[>7l\x1b[>1l\x1b[>9h');
  }

  // jsbterm mouse
  if (opt.jsbtermMouse != null) {
    // + = advanced mode
    if (opt.jsbtermMouse) this._write('\x1b[0~ZwLMRK+1Q\x1b\\');
    else this._write('\x1b[0~ZwQ\x1b\\');
  }

  // gpm mouse
  if (opt.gpmMouse != null) {
    if (opt.gpmMouse) this.enableGpm();
    else this.disableGpm();
  }
};

// CSI Ps ; Ps r
//   Set Scrolling Region [top;bottom] (default = full size of win-
//   dow) (DECSTBM).
// CSI ? Pm r
Program.prototype.decstbm =
Program.prototype.csr =
Program.prototype.setScrollRegion = function(top, bottom) {
  if (!this.zero) {
    top = (top || 1) - 1;
    bottom = (bottom || this.rows) - 1;
  } else {
    top = top || 0;
    bottom = bottom || (this.rows - 1);
  }
  this.scrollTop = top;
  this.scrollBottom = bottom;
  this.x = 0;
  this.y = 0;
  this._ncoords();
  if (this.tput) return this.put.csr(top, bottom);
  return this._write('\x1b[' + (top + 1) + ';' + (bottom + 1) + 'r');
};

// CSI s
//   Save cursor (ANSI.SYS).
Program.prototype.scA =
Program.prototype.saveCursorA = function() {
  this.savedX = this.x;
  this.savedY = this.y;
  if (this.tput) return this.put.sc();
  return this._write('\x1b[s');
};

// CSI u
//   Restore cursor (ANSI.SYS).
Program.prototype.rcA =
Program.prototype.restoreCursorA = function() {
  this.x = this.savedX || 0;
  this.y = this.savedY || 0;
  if (this.tput) return this.put.rc();
  return this._write('\x1b[u');
};

/**
 * Lesser Used
 */

// CSI Ps I
//   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
Program.prototype.cht =
Program.prototype.cursorForwardTab = function(param) {
  this.x += 8;
  this._ncoords();
  if (this.tput) return this.put.tab(param);
  return this._write('\x1b[' + (param || 1) + 'I');
};

// CSI Ps S  Scroll up Ps lines (default = 1) (SU).
Program.prototype.su =
Program.prototype.scrollUp = function(param) {
  this.y -= param || 1;
  this._ncoords();
  if (this.tput) return this.put.parm_index(param);
  return this._write('\x1b[' + (param || 1) + 'S');
};

// CSI Ps T  Scroll down Ps lines (default = 1) (SD).
Program.prototype.sd =
Program.prototype.scrollDown = function(param) {
  this.y += param || 1;
  this._ncoords();
  if (this.tput) return this.put.parm_rindex(param);
  return this._write('\x1b[' + (param || 1) + 'T');
};

// CSI Ps ; Ps ; Ps ; Ps ; Ps T
//   Initiate highlight mouse tracking.  Parameters are
//   [func;startx;starty;firstrow;lastrow].  See the section Mouse
//   Tracking.
Program.prototype.initMouseTracking = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + 'T');
};

// CSI > Ps; Ps T
//   Reset one or more features of the title modes to the default
//   value.  Normally, "reset" disables the feature.  It is possi-
//   ble to disable the ability to reset features by compiling a
//   different default for the title modes into xterm.
//     Ps = 0  -> Do not set window/icon labels using hexadecimal.
//     Ps = 1  -> Do not query window/icon labels using hexadeci-
//     mal.
//     Ps = 2  -> Do not set window/icon labels using UTF-8.
//     Ps = 3  -> Do not query window/icon labels using UTF-8.
//   (See discussion of "Title Modes").
Program.prototype.resetTitleModes = function() {
  return this._write('\x1b[>' + slice.call(arguments).join(';') + 'T');
};

// CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
Program.prototype.cbt =
Program.prototype.cursorBackwardTab = function(param) {
  this.x -= 8;
  this._ncoords();
  if (this.tput) return this.put.cbt(param);
  return this._write('\x1b[' + (param || 1) + 'Z');
};

// CSI Ps b  Repeat the preceding graphic character Ps times (REP).
Program.prototype.rep =
Program.prototype.repeatPrecedingCharacter = function(param) {
  this.x += param || 1;
  this._ncoords();
  if (this.tput) return this.put.rep(param);
  return this._write('\x1b[' + (param || 1) + 'b');
};

// CSI Ps g  Tab Clear (TBC).
//     Ps = 0  -> Clear Current Column (default).
//     Ps = 3  -> Clear All.
// Potentially:
//   Ps = 2  -> Clear Stops on Line.
//   http://vt100.net/annarbor/aaa-ug/section6.html
Program.prototype.tbc =
Program.prototype.tabClear = function(param) {
  if (this.tput) return this.put.tbc(param);
  return this._write('\x1b[' + (param || 0) + 'g');
};

// CSI Pm i  Media Copy (MC).
//     Ps = 0  -> Print screen (default).
//     Ps = 4  -> Turn off printer controller mode.
//     Ps = 5  -> Turn on printer controller mode.
// CSI ? Pm i
//   Media Copy (MC, DEC-specific).
//     Ps = 1  -> Print line containing cursor.
//     Ps = 4  -> Turn off autoprint mode.
//     Ps = 5  -> Turn on autoprint mode.
//     Ps = 1  0  -> Print composed display, ignores DECPEX.
//     Ps = 1  1  -> Print all pages.
Program.prototype.mc =
Program.prototype.mediaCopy = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + 'i');
};

Program.prototype.print_screen =
Program.prototype.ps =
Program.prototype.mc0 = function() {
  if (this.tput) return this.put.mc0();
  return this.mc('0');
};

Program.prototype.prtr_on =
Program.prototype.po =
Program.prototype.mc5 = function() {
  if (this.tput) return this.put.mc5();
  return this.mc('5');
};

Program.prototype.prtr_off =
Program.prototype.pf =
Program.prototype.mc4 = function() {
  if (this.tput) return this.put.mc4();
  return this.mc('4');
};

Program.prototype.prtr_non =
Program.prototype.pO =
Program.prototype.mc5p = function() {
  if (this.tput) return this.put.mc5p();
  return this.mc('?5');
};

// CSI > Ps; Ps m
//   Set or reset resource-values used by xterm to decide whether
//   to construct escape sequences holding information about the
//   modifiers pressed with a given key.  The first parameter iden-
//   tifies the resource to set/reset.  The second parameter is the
//   value to assign to the resource.  If the second parameter is
//   omitted, the resource is reset to its initial value.
//     Ps = 1  -> modifyCursorKeys.
//     Ps = 2  -> modifyFunctionKeys.
//     Ps = 4  -> modifyOtherKeys.
//   If no parameters are given, all resources are reset to their
//   initial values.
Program.prototype.setResources = function() {
  return this._write('\x1b[>' + slice.call(arguments).join(';') + 'm');
};

// CSI > Ps n
//   Disable modifiers which may be enabled via the CSI > Ps; Ps m
//   sequence.  This corresponds to a resource value of "-1", which
//   cannot be set with the other sequence.  The parameter identi-
//   fies the resource to be disabled:
//     Ps = 1  -> modifyCursorKeys.
//     Ps = 2  -> modifyFunctionKeys.
//     Ps = 4  -> modifyOtherKeys.
//   If the parameter is omitted, modifyFunctionKeys is disabled.
//   When modifyFunctionKeys is disabled, xterm uses the modifier
//   keys to make an extended sequence of functions rather than
//   adding a parameter to each function key to denote the modi-
//   fiers.
Program.prototype.disableModifiers = function(param) {
  return this._write('\x1b[>' + (param || '') + 'n');
};

// CSI > Ps p
//   Set resource value pointerMode.  This is used by xterm to
//   decide whether to hide the pointer cursor as the user types.
//   Valid values for the parameter:
//     Ps = 0  -> never hide the pointer.
//     Ps = 1  -> hide if the mouse tracking mode is not enabled.
//     Ps = 2  -> always hide the pointer.  If no parameter is
//     given, xterm uses the default, which is 1 .
Program.prototype.setPointerMode = function(param) {
  return this._write('\x1b[>' + (param || '') + 'p');
};

// CSI ! p   Soft terminal reset (DECSTR).
// http://vt100.net/docs/vt220-rm/table4-10.html
Program.prototype.decstr =
Program.prototype.rs2 =
Program.prototype.softReset = function() {
  //if (this.tput) return this.put.init_2string();
  //if (this.tput) return this.put.reset_2string();
  if (this.tput) return this.put.rs2();
  //return this._write('\x1b[!p');
  //return this._write('\x1b[!p\x1b[?3;4l\x1b[4l\x1b>'); // init
  return this._write('\x1b[!p\x1b[?3;4l\x1b[4l\x1b>'); // reset
};

// CSI Ps$ p
//   Request ANSI mode (DECRQM).  For VT300 and up, reply is
//     CSI Ps; Pm$ y
//   where Ps is the mode number as in RM, and Pm is the mode
//   value:
//     0 - not recognized
//     1 - set
//     2 - reset
//     3 - permanently set
//     4 - permanently reset
Program.prototype.decrqm =
Program.prototype.requestAnsiMode = function(param) {
  return this._write('\x1b[' + (param || '') + '$p');
};

// CSI ? Ps$ p
//   Request DEC private mode (DECRQM).  For VT300 and up, reply is
//     CSI ? Ps; Pm$ p
//   where Ps is the mode number as in DECSET, Pm is the mode value
//   as in the ANSI DECRQM.
Program.prototype.decrqmp =
Program.prototype.requestPrivateMode = function(param) {
  return this._write('\x1b[?' + (param || '') + '$p');
};

// CSI Ps ; Ps " p
//   Set conformance level (DECSCL).  Valid values for the first
//   parameter:
//     Ps = 6 1  -> VT100.
//     Ps = 6 2  -> VT200.
//     Ps = 6 3  -> VT300.
//   Valid values for the second parameter:
//     Ps = 0  -> 8-bit controls.
//     Ps = 1  -> 7-bit controls (always set for VT100).
//     Ps = 2  -> 8-bit controls.
Program.prototype.decscl =
Program.prototype.setConformanceLevel = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '"p');
};

// CSI Ps q  Load LEDs (DECLL).
//     Ps = 0  -> Clear all LEDS (default).
//     Ps = 1  -> Light Num Lock.
//     Ps = 2  -> Light Caps Lock.
//     Ps = 3  -> Light Scroll Lock.
//     Ps = 2  1  -> Extinguish Num Lock.
//     Ps = 2  2  -> Extinguish Caps Lock.
//     Ps = 2  3  -> Extinguish Scroll Lock.
Program.prototype.decll =
Program.prototype.loadLEDs = function(param) {
  return this._write('\x1b[' + (param || '') + 'q');
};

// CSI Ps SP q
//   Set cursor style (DECSCUSR, VT520).
//     Ps = 0  -> blinking block.
//     Ps = 1  -> blinking block (default).
//     Ps = 2  -> steady block.
//     Ps = 3  -> blinking underline.
//     Ps = 4  -> steady underline.
Program.prototype.decscusr =
Program.prototype.setCursorStyle = function(param) {
  switch (param) {
    case 'blinking block':
      param = 1;
      break;
    case 'block':
    case 'steady block':
      param = 2;
      break;
    case 'blinking underline':
      param = 3;
      break;
    case 'underline':
    case 'steady underline':
      param = 4;
      break;
    case 'blinking bar':
      param = 5;
      break;
    case 'bar':
    case 'steady bar':
      param = 6;
      break;
  }
  if (param === 2 && this.has('Se')) {
    return this.put.Se();
  }
  if (this.has('Ss')) {
    return this.put.Ss(param);
  }
  return this._write('\x1b[' + (param || 1) + ' q');
};

// CSI Ps " q
//   Select character protection attribute (DECSCA).  Valid values
//   for the parameter:
//     Ps = 0  -> DECSED and DECSEL can erase (default).
//     Ps = 1  -> DECSED and DECSEL cannot erase.
//     Ps = 2  -> DECSED and DECSEL can erase.
Program.prototype.decsca =
Program.prototype.setCharProtectionAttr = function(param) {
  return this._write('\x1b[' + (param || 0) + '"q');
};

// CSI ? Pm r
//   Restore DEC Private Mode Values.  The value of Ps previously
//   saved is restored.  Ps values are the same as for DECSET.
Program.prototype.restorePrivateValues = function() {
  return this._write('\x1b[?' + slice.call(arguments).join(';') + 'r');
};

// CSI Pt; Pl; Pb; Pr; Ps$ r
//   Change Attributes in Rectangular Area (DECCARA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Ps denotes the SGR attributes to change: 0, 1, 4, 5, 7.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.deccara =
Program.prototype.setAttrInRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '$r');
};

// CSI ? Pm s
//   Save DEC Private Mode Values.  Ps values are the same as for
//   DECSET.
Program.prototype.savePrivateValues = function() {
  return this._write('\x1b[?' + slice.call(arguments).join(';') + 's');
};

// CSI Ps ; Ps ; Ps t
//   Window manipulation (from dtterm, as well as extensions).
//   These controls may be disabled using the allowWindowOps
//   resource.  Valid values for the first (and any additional
//   parameters) are:
//     Ps = 1  -> De-iconify window.
//     Ps = 2  -> Iconify window.
//     Ps = 3  ;  x ;  y -> Move window to [x, y].
//     Ps = 4  ;  height ;  width -> Resize the xterm window to
//     height and width in pixels.
//     Ps = 5  -> Raise the xterm window to the front of the stack-
//     ing order.
//     Ps = 6  -> Lower the xterm window to the bottom of the
//     stacking order.
//     Ps = 7  -> Refresh the xterm window.
//     Ps = 8  ;  height ;  width -> Resize the text area to
//     [height;width] in characters.
//     Ps = 9  ;  0  -> Restore maximized window.
//     Ps = 9  ;  1  -> Maximize window (i.e., resize to screen
//     size).
//     Ps = 1 0  ;  0  -> Undo full-screen mode.
//     Ps = 1 0  ;  1  -> Change to full-screen.
//     Ps = 1 1  -> Report xterm window state.  If the xterm window
//     is open (non-iconified), it returns CSI 1 t .  If the xterm
//     window is iconified, it returns CSI 2 t .
//     Ps = 1 3  -> Report xterm window position.  Result is CSI 3
//     ; x ; y t
//     Ps = 1 4  -> Report xterm window in pixels.  Result is CSI
//     4  ;  height ;  width t
//     Ps = 1 8  -> Report the size of the text area in characters.
//     Result is CSI  8  ;  height ;  width t
//     Ps = 1 9  -> Report the size of the screen in characters.
//     Result is CSI  9  ;  height ;  width t
//     Ps = 2 0  -> Report xterm window's icon label.  Result is
//     OSC  L  label ST
//     Ps = 2 1  -> Report xterm window's title.  Result is OSC  l
//     label ST
//     Ps = 2 2  ;  0  -> Save xterm icon and window title on
//     stack.
//     Ps = 2 2  ;  1  -> Save xterm icon title on stack.
//     Ps = 2 2  ;  2  -> Save xterm window title on stack.
//     Ps = 2 3  ;  0  -> Restore xterm icon and window title from
//     stack.
//     Ps = 2 3  ;  1  -> Restore xterm icon title from stack.
//     Ps = 2 3  ;  2  -> Restore xterm window title from stack.
//     Ps >= 2 4  -> Resize to Ps lines (DECSLPP).
Program.prototype.manipulateWindow = function() {
  var args = slice.call(arguments);

  var callback = typeof args[args.length - 1] === 'function'
    ? args.pop()
    : function() {};

  return this.response('window-manipulation',
    '\x1b[' + args.join(';') + 't', callback);
};

Program.prototype.getWindowSize = function(callback) {
  return this.manipulateWindow(18, callback);
};

// CSI Pt; Pl; Pb; Pr; Ps$ t
//   Reverse Attributes in Rectangular Area (DECRARA), VT400 and
//   up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Ps denotes the attributes to reverse, i.e.,  1, 4, 5, 7.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.decrara =
Program.prototype.reverseAttrInRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '$t');
};

// CSI > Ps; Ps t
//   Set one or more features of the title modes.  Each parameter
//   enables a single feature.
//     Ps = 0  -> Set window/icon labels using hexadecimal.
//     Ps = 1  -> Query window/icon labels using hexadecimal.
//     Ps = 2  -> Set window/icon labels using UTF-8.
//     Ps = 3  -> Query window/icon labels using UTF-8.  (See dis-
//     cussion of "Title Modes")
// XXX VTE bizarelly echos this:
Program.prototype.setTitleModeFeature = function() {
  return this._twrite('\x1b[>' + slice.call(arguments).join(';') + 't');
};

// CSI Ps SP t
//   Set warning-bell volume (DECSWBV, VT520).
//     Ps = 0  or 1  -> off.
//     Ps = 2 , 3  or 4  -> low.
//     Ps = 5 , 6 , 7 , or 8  -> high.
Program.prototype.decswbv =
Program.prototype.setWarningBellVolume = function(param) {
  return this._write('\x1b[' + (param || '') + ' t');
};

// CSI Ps SP u
//   Set margin-bell volume (DECSMBV, VT520).
//     Ps = 1  -> off.
//     Ps = 2 , 3  or 4  -> low.
//     Ps = 0 , 5 , 6 , 7 , or 8  -> high.
Program.prototype.decsmbv =
Program.prototype.setMarginBellVolume = function(param) {
  return this._write('\x1b[' + (param || '') + ' u');
};

// CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
//   Copy Rectangular Area (DECCRA, VT400 and up).
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Pp denotes the source page.
//     Pt; Pl denotes the target location.
//     Pp denotes the target page.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.deccra =
Program.prototype.copyRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '$v');
};

// CSI Pt ; Pl ; Pb ; Pr ' w
//   Enable Filter Rectangle (DECEFR), VT420 and up.
//   Parameters are [top;left;bottom;right].
//   Defines the coordinates of a filter rectangle and activates
//   it.  Anytime the locator is detected outside of the filter
//   rectangle, an outside rectangle event is generated and the
//   rectangle is disabled.  Filter rectangles are always treated
//   as "one-shot" events.  Any parameters that are omitted default
//   to the current locator position.  If all parameters are omit-
//   ted, any locator motion will be reported.  DECELR always can-
//   cels any prevous rectangle definition.
Program.prototype.decefr =
Program.prototype.enableFilterRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '\'w');
};

// CSI Ps x  Request Terminal Parameters (DECREQTPARM).
//   if Ps is a "0" (default) or "1", and xterm is emulating VT100,
//   the control sequence elicits a response of the same form whose
//   parameters describe the terminal:
//     Ps -> the given Ps incremented by 2.
//     Pn = 1  <- no parity.
//     Pn = 1  <- eight bits.
//     Pn = 1  <- 2  8  transmit 38.4k baud.
//     Pn = 1  <- 2  8  receive 38.4k baud.
//     Pn = 1  <- clock multiplier.
//     Pn = 0  <- STP flags.
Program.prototype.decreqtparm =
Program.prototype.requestParameters = function(param) {
  return this._write('\x1b[' + (param || 0) + 'x');
};

// CSI Ps x  Select Attribute Change Extent (DECSACE).
//     Ps = 0  -> from start to end position, wrapped.
//     Ps = 1  -> from start to end position, wrapped.
//     Ps = 2  -> rectangle (exact).
Program.prototype.decsace =
Program.prototype.selectChangeExtent = function(param) {
  return this._write('\x1b[' + (param || 0) + 'x');
};

// CSI Pc; Pt; Pl; Pb; Pr$ x
//   Fill Rectangular Area (DECFRA), VT420 and up.
//     Pc is the character to use.
//     Pt; Pl; Pb; Pr denotes the rectangle.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.decfra =
Program.prototype.fillRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '$x');
};

// CSI Ps ; Pu ' z
//   Enable Locator Reporting (DECELR).
//   Valid values for the first parameter:
//     Ps = 0  -> Locator disabled (default).
//     Ps = 1  -> Locator enabled.
//     Ps = 2  -> Locator enabled for one report, then disabled.
//   The second parameter specifies the coordinate unit for locator
//   reports.
//   Valid values for the second parameter:
//     Pu = 0  <- or omitted -> default to character cells.
//     Pu = 1  <- device physical pixels.
//     Pu = 2  <- character cells.
Program.prototype.decelr =
Program.prototype.enableLocatorReporting = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '\'z');
};

// CSI Pt; Pl; Pb; Pr$ z
//   Erase Rectangular Area (DECERA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.decera =
Program.prototype.eraseRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '$z');
};

// CSI Pm ' {
//   Select Locator Events (DECSLE).
//   Valid values for the first (and any additional parameters)
//   are:
//     Ps = 0  -> only respond to explicit host requests (DECRQLP).
//                (This is default).  It also cancels any filter
//   rectangle.
//     Ps = 1  -> report button down transitions.
//     Ps = 2  -> do not report button down transitions.
//     Ps = 3  -> report button up transitions.
//     Ps = 4  -> do not report button up transitions.
Program.prototype.decsle =
Program.prototype.setLocatorEvents = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '\'{');
};

// CSI Pt; Pl; Pb; Pr$ {
//   Selective Erase Rectangular Area (DECSERA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
Program.prototype.decsera =
Program.prototype.selectiveEraseRectangle = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + '${');
};

// CSI Ps ' |
//   Request Locator Position (DECRQLP).
//   Valid values for the parameter are:
//     Ps = 0 , 1 or omitted -> transmit a single DECLRP locator
//     report.

//   If Locator Reporting has been enabled by a DECELR, xterm will
//   respond with a DECLRP Locator Report.  This report is also
//   generated on button up and down events if they have been
//   enabled with a DECSLE, or when the locator is detected outside
//   of a filter rectangle, if filter rectangles have been enabled
//   with a DECEFR.

//     -> CSI Pe ; Pb ; Pr ; Pc ; Pp &  w

//   Parameters are [event;button;row;column;page].
//   Valid values for the event:
//     Pe = 0  -> locator unavailable - no other parameters sent.
//     Pe = 1  -> request - xterm received a DECRQLP.
//     Pe = 2  -> left button down.
//     Pe = 3  -> left button up.
//     Pe = 4  -> middle button down.
//     Pe = 5  -> middle button up.
//     Pe = 6  -> right button down.
//     Pe = 7  -> right button up.
//     Pe = 8  -> M4 button down.
//     Pe = 9  -> M4 button up.
//     Pe = 1 0  -> locator outside filter rectangle.
//   ``button'' parameter is a bitmask indicating which buttons are
//     pressed:
//     Pb = 0  <- no buttons down.
//     Pb & 1  <- right button down.
//     Pb & 2  <- middle button down.
//     Pb & 4  <- left button down.
//     Pb & 8  <- M4 button down.
//   ``row'' and ``column'' parameters are the coordinates of the
//     locator position in the xterm window, encoded as ASCII deci-
//     mal.
//   The ``page'' parameter is not used by xterm, and will be omit-
//   ted.
Program.prototype.decrqlp =
Program.prototype.req_mouse_pos =
Program.prototype.reqmp =
Program.prototype.requestLocatorPosition = function(param, callback) {
  // See also:
  // get_mouse / getm / Gm
  // mouse_info / minfo / Mi
  // Correct for tput?
  if (this.has('req_mouse_pos')) {
    var code = this.tput.req_mouse_pos(param);
    return this.response('locator-position', code, callback);
  }
  return this.response('locator-position',
    '\x1b[' + (param || '') + '\'|', callback);
};

// CSI P m SP }
// Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
// NOTE: xterm doesn't enable this code by default.
Program.prototype.decic =
Program.prototype.insertColumns = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + ' }');
};

// CSI P m SP ~
// Delete P s Column(s) (default = 1) (DECDC), VT420 and up
// NOTE: xterm doesn't enable this code by default.
Program.prototype.decdc =
Program.prototype.deleteColumns = function() {
  return this._write('\x1b[' + slice.call(arguments).join(';') + ' ~');
};

Program.prototype.out = function(name) {
  var args = Array.prototype.slice.call(arguments, 1);
  this.ret = true;
  var out = this[name].apply(this, args);
  this.ret = false;
  return out;
};

Program.prototype.sigtstp = function(callback) {
  var resume = this.pause();

  process.once('SIGCONT', function() {
    resume();
    if (callback) callback();
  });

  process.kill(process.pid, 'SIGTSTP');
};

Program.prototype.pause = function(callback) {
  var self = this
    , isAlt = this.isAlt
    , mouseEnabled = this.mouseEnabled;

  this.lsaveCursor('pause');
  //this.csr(0, screen.height - 1);
  if (isAlt) this.normalBuffer();
  this.showCursor();
  if (mouseEnabled) this.disableMouse();

  var write = this.output.write;
  this.output.write = function() {};
  if (this.input.setRawMode) {
    this.input.setRawMode(false);
  }
  this.input.pause();

  return this._resume = function() {
    delete self._resume;

    if (self.input.setRawMode) {
      self.input.setRawMode(true);
    }
    self.input.resume();
    self.output.write = write;

    if (isAlt) self.alternateBuffer();
    //self.csr(0, screen.height - 1);
    if (mouseEnabled) self.enableMouse();
    self.lrestoreCursor('pause', true);

    if (callback) callback();
  };
};

Program.prototype.resume = function() {
  if (this._resume) return this._resume();
};

/**
 * Helpers
 */

// We could do this easier by just manipulating the _events object, or for
// older versions of node, manipulating the array returned by listeners(), but
// neither of these methods are guaranteed to work in future versions of node.
function unshiftEvent(obj, event, listener) {
  var listeners = obj.listeners(event);
  obj.removeAllListeners(event);
  obj.on(event, listener);
  listeners.forEach(function(listener) {
    obj.on(event, listener);
  });
}

function merge(out) {
  slice.call(arguments, 1).forEach(function(obj) {
    Object.keys(obj).forEach(function(key) {
      out[key] = obj[key];
    });
  });
  return out;
}

/**
 * Expose
 */

module.exports = Program;
