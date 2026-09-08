/**
 * screen.js - screen node for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

var path = require('path')
  , fs = require('fs')
  , cp = require('child_process');

var colors = require('../colors')
  , program = require('../program')
  , unicode = require('../unicode');

var nextTick = global.setImmediate || process.nextTick.bind(process);

var helpers = require('../helpers');

var Node = require('./node');
var Log = require('./log');
var Element = require('./element');
var Box = require('./box');

/**
 * Screen
 */

function Screen(options) {
  var self = this;

  if (!(this instanceof Node)) {
    return new Screen(options);
  }

  Screen.bind(this);

  options = options || {};
  if (options.rsety && options.listen) {
    options = { program: options };
  }

  this.program = options.program;

  if (!this.program) {
    this.program = program({
      input: options.input,
      output: options.output,
      log: options.log,
      debug: options.debug,
      dump: options.dump,
      terminal: options.terminal || options.term,
      resizeTimeout: options.resizeTimeout,
      forceUnicode: options.forceUnicode,
      tput: true,
      buffer: true,
      zero: true
    });
  } else {
    this.program.setupTput();
    this.program.useBuffer = true;
    this.program.zero = true;
    this.program.options.resizeTimeout = options.resizeTimeout;
    if (options.forceUnicode != null) {
      this.program.tput.features.unicode = options.forceUnicode;
      this.program.tput.unicode = options.forceUnicode;
    }
  }

  this.tput = this.program.tput;

  Node.call(this, options);

  this.autoPadding = options.autoPadding !== false;
  this.tabc = Array((options.tabSize || 4) + 1).join(' ');
  this.dockBorders = options.dockBorders;

  this.ignoreLocked = options.ignoreLocked || [];

  this._unicode = this.tput.unicode || this.tput.numbers.U8 === 1;
  this.fullUnicode = this.options.fullUnicode && this._unicode;

  this.dattr = ((0 << 18) | (0x1ff << 9)) | 0x1ff;

  this.renders = 0;
  this.position = {
    left: this.left = this.aleft = this.rleft = 0,
    right: this.right = this.aright = this.rright = 0,
    top: this.top = this.atop = this.rtop = 0,
    bottom: this.bottom = this.abottom = this.rbottom = 0,
    get height() { return self.height; },
    get width() { return self.width; }
  };

  this.ileft = 0;
  this.itop = 0;
  this.iright = 0;
  this.ibottom = 0;
  this.iheight = 0;
  this.iwidth = 0;

  this.padding = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  };

  this.hover = null;
  this.history = [];
  this.clickable = [];
  this.keyable = [];
  this.grabKeys = false;
  this.lockKeys = false;
  this.focused;
  this._buf = '';

  this._ci = -1;

  if (options.title) {
    this.title = options.title;
  }

  options.cursor = options.cursor || {
    artificial: options.artificialCursor,
    shape: options.cursorShape,
    blink: options.cursorBlink,
    color: options.cursorColor
  };

  this.cursor = {
    artificial: options.cursor.artificial || false,
    shape: options.cursor.shape || 'block',
    blink: options.cursor.blink || false,
    color: options.cursor.color || null,
    _set: false,
    _state: 1,
    _hidden: true
  };

  this.program.on('resize', function() {
    self.alloc();
    self.render();
    (function emit(el) {
      el.emit('resize');
      el.children.forEach(emit);
    })(self);
  });

  this.program.on('focus', function() {
    self.emit('focus');
  });

  this.program.on('blur', function() {
    self.emit('blur');
  });

  this.program.on('warning', function(text) {
    self.emit('warning', text);
  });

  this.on('newListener', function fn(type) {
    if (type === 'keypress' || type.indexOf('key ') === 0 || type === 'mouse') {
      if (type === 'keypress' || type.indexOf('key ') === 0) self._listenKeys();
      if (type === 'mouse') self._listenMouse();
    }
    if (type === 'mouse'
      || type === 'click'
      || type === 'mouseover'
      || type === 'mouseout'
      || type === 'mousedown'
      || type === 'mouseup'
      || type === 'mousewheel'
      || type === 'wheeldown'
      || type === 'wheelup'
      || type === 'mousemove') {
      self._listenMouse();
    }
  });

  this.setMaxListeners(Infinity);

  this.enter();

  this.postEnter();
}

Screen.global = null;

Screen.total = 0;

Screen.instances = [];

Screen.bind = function(screen) {
  if (!Screen.global) {
    Screen.global = screen;
  }

  if (!~Screen.instances.indexOf(screen)) {
    Screen.instances.push(screen);
    screen.index = Screen.total;
    Screen.total++;
  }

  if (Screen._bound) return;
  Screen._bound = true;

  process.on('uncaughtException', Screen._exceptionHandler = function(err) {
    if (process.listeners('uncaughtException').length > 1) {
      return;
    }
    Screen.instances.slice().forEach(function(screen) {
      screen.destroy();
    });
    err = err || new Error('Uncaught Exception.');
    console.error(err.stack ? err.stack + '' : err + '');
    nextTick(function() {
      process.exit(1);
    });
  });

  ['SIGTERM', 'SIGINT', 'SIGQUIT'].forEach(function(signal) {
    var name = '_' + signal.toLowerCase() + 'Handler';
    process.on(signal, Screen[name] = function() {
      if (process.listeners(signal).length > 1) {
        return;
      }
      nextTick(function() {
        process.exit(0);
      });
    });
  });

  process.on('exit', Screen._exitHandler = function() {
    Screen.instances.slice().forEach(function(screen) {
      screen.destroy();
    });
  });
};

Screen.prototype.__proto__ = Node.prototype;

Screen.prototype.type = 'screen';

Screen.prototype.__defineGetter__('title', function() {
  return this.program.title;
});

Screen.prototype.__defineSetter__('title', function(title) {
  return this.program.title = title;
});

Screen.prototype.__defineGetter__('terminal', function() {
  return this.program.terminal;
});

Screen.prototype.__defineSetter__('terminal', function(terminal) {
  this.setTerminal(terminal);
  return this.program.terminal;
});

Screen.prototype.setTerminal = function(terminal) {
  var entered = !!this.program.isAlt;
  if (entered) {
    this._buf = '';
    this.program._buf = '';
    this.leave();
  }
  this.program.setTerminal(terminal);
  this.tput = this.program.tput;
  if (entered) {
    this.enter();
  }
};

Screen.prototype.enter = function() {
  if (this.program.isAlt) return;
  if (!this.cursor._set) {
    if (this.options.cursor.shape) {
      this.cursorShape(this.cursor.shape, this.cursor.blink);
    }
    if (this.options.cursor.color) {
      this.cursorColor(this.cursor.color);
    }
  }
  if (process.platform === 'win32') {
    try {
      cp.execSync('cls', { stdio: 'ignore', timeout: 1000 });
    } catch (e) {
      ;
    }
  }
  this.program.alternateBuffer();
  this.program.put.keypad_xmit();
  this.program.csr(0, this.height - 1);
  this.program.hideCursor();
  this.program.cup(0, 0);
  // We need this for tmux now:
  if (this.tput.strings.ena_acs) {
    this.program._write(this.tput.enacs());
  }
  this.alloc();
};

Screen.prototype.leave = function() {
  if (!this.program.isAlt) return;
  this.program.put.keypad_local();
  if (this.program.scrollTop !== 0
      || this.program.scrollBottom !== this.rows - 1) {
    this.program.csr(0, this.height - 1);
  }
  // XXX For some reason if alloc/clear() is before this
  // line, it doesn't work on linux console.
  this.program.showCursor();
  this.alloc();
  if (this._listenedMouse) {
    this.program.disableMouse();
  }
  this.program.normalBuffer();
  if (this.cursor._set) this.cursorReset();
  this.program.flush();
  if (process.platform === 'win32') {
    try {
      cp.execSync('cls', { stdio: 'ignore', timeout: 1000 });
    } catch (e) {
      ;
    }
  }
};

Screen.prototype.postEnter = function() {
  var self = this;
  if (this.options.debug) {
    this.debugLog = new Log({
      screen: this,
      parent: this,
      hidden: true,
      draggable: true,
      left: 'center',
      top: 'center',
      width: '30%',
      height: '30%',
      border: 'line',
      label: ' {bold}Debug Log{/bold} ',
      tags: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'yellow'
        },
        style: {
          inverse: true
        }
      }
    });

    this.debugLog.toggle = function() {
      if (self.debugLog.hidden) {
        self.saveFocus();
        self.debugLog.show();
        self.debugLog.setFront();
        self.debugLog.focus();
      } else {
        self.debugLog.hide();
        self.restoreFocus();
      }
      self.render();
    };

    this.debugLog.key(['q', 'escape'], self.debugLog.toggle);
    this.key('f12', self.debugLog.toggle);
  }

  if (this.options.warnings) {
    this.on('warning', function(text) {
      var warning = new Box({
        screen: self,
        parent: self,
        left: 'center',
        top: 'center',
        width: 'shrink',
        padding: 1,
        height: 'shrink',
        align: 'center',
        valign: 'middle',
        border: 'line',
        label: ' {red-fg}{bold}WARNING{/} ',
        content: '{bold}' + text + '{/bold}',
        tags: true
      });
      self.render();
      var timeout = setTimeout(function() {
        warning.destroy();
        self.render();
      }, 1500);
      if (timeout.unref) {
        timeout.unref();
      }
    });
  }
};

Screen.prototype._destroy = Screen.prototype.destroy;
Screen.prototype.destroy = function() {
  this.leave();

  var index = Screen.instances.indexOf(this);
  if (~index) {
    Screen.instances.splice(index, 1);
    Screen.total--;

    Screen.global = Screen.instances[0];

    if (Screen.total === 0) {
      Screen.global = null;

      process.removeListener('uncaughtException', Screen._exceptionHandler);
      process.removeListener('SIGTERM', Screen._sigtermHandler);
      process.removeListener('SIGINT', Screen._sigintHandler);
      process.removeListener('SIGQUIT', Screen._sigquitHandler);
      process.removeListener('exit', Screen._exitHandler);
      delete Screen._exceptionHandler;
      delete Screen._sigtermHandler;
      delete Screen._sigintHandler;
      delete Screen._sigquitHandler;
      delete Screen._exitHandler;

      delete Screen._bound;
    }

    this.destroyed = true;
    this.emit('destroy');
    this._destroy();
  }

  this.program.destroy();
};

Screen.prototype.log = function() {
  return this.program.log.apply(this.program, arguments);
};

Screen.prototype.debug = function() {
  if (this.debugLog) {
    this.debugLog.log.apply(this.debugLog, arguments);
  }
  return this.program.debug.apply(this.program, arguments);
};

Screen.prototype._listenMouse = function(el) {
  var self = this;

  if (el && !~this.clickable.indexOf(el)) {
    el.clickable = true;
    this.clickable.push(el);
  }

  if (this._listenedMouse) return;
  this._listenedMouse = true;

  this.program.enableMouse();
  if (this.options.sendFocus) {
    this.program.setMouse({ sendFocus: true }, true);
  }

  this.on('render', function() {
    self._needsClickableSort = true;
  });

  this.program.on('mouse', function(data) {
    if (self.lockKeys) return;

    if (self._needsClickableSort) {
      self.clickable = helpers.hsort(self.clickable);
      self._needsClickableSort = false;
    }

    var i = 0
      , el
      , set
      , pos;

    for (; i < self.clickable.length; i++) {
      el = self.clickable[i];

      if (el.detached || !el.visible) {
        continue;
      }

      // if (self.grabMouse && self.focused !== el
      //     && !el.hasAncestor(self.focused)) continue;

      pos = el.lpos;
      if (!pos) continue;

      if (data.x >= pos.xi && data.x < pos.xl
          && data.y >= pos.yi && data.y < pos.yl) {
        el.emit('mouse', data);
        if (data.action === 'mousedown') {
          self.mouseDown = el;
        } else if (data.action === 'mouseup') {
          (self.mouseDown || el).emit('click', data);
          self.mouseDown = null;
        } else if (data.action === 'mousemove') {
          if (self.hover && el.index > self.hover.index) {
            set = false;
          }
          if (self.hover !== el && !set) {
            if (self.hover) {
              self.hover.emit('mouseout', data);
            }
            el.emit('mouseover', data);
            self.hover = el;
          }
          set = true;
        }
        el.emit(data.action, data);
        break;
      }
    }

    // Just mouseover?
    if ((data.action === 'mousemove'
        || data.action === 'mousedown'
        || data.action === 'mouseup')
        && self.hover
        && !set) {
      self.hover.emit('mouseout', data);
      self.hover = null;
    }

    self.emit('mouse', data);
    self.emit(data.action, data);
  });

  // Autofocus highest element.
  // this.on('element click', function(el, data) {
  //   var target;
  //   do {
  //     if (el.clickable === true && el.options.autoFocus !== false) {
  //       target = el;
  //     }
  //   } while (el = el.parent);
  //   if (target) target.focus();
  // });

  // Autofocus elements with the appropriate option.
  this.on('element click', function(el) {
    if (el.clickable === true && el.options.autoFocus !== false) {
      el.focus();
    }
  });
};

Screen.prototype.enableMouse = function(el) {
  this._listenMouse(el);
};

Screen.prototype._listenKeys = function(el) {
  var self = this;

  if (el && !~this.keyable.indexOf(el)) {
    el.keyable = true;
    this.keyable.push(el);
  }

  if (this._listenedKeys) return;
  this._listenedKeys = true;

  // NOTE: The event emissions used to be reversed:
  // element + screen
  // They are now:
  // screen + element
  // After the first keypress emitted, the handler
  // checks to make sure grabKeys, lockKeys, and focused
  // weren't changed, and handles those situations appropriately.
  this.program.on('keypress', function(ch, key) {
    if (self.lockKeys && !~self.ignoreLocked.indexOf(key.full)) {
      return;
    }

    var focused = self.focused
      , grabKeys = self.grabKeys;

    if (!grabKeys || ~self.ignoreLocked.indexOf(key.full)) {
      self.emit('keypress', ch, key);
      self.emit('key ' + key.full, ch, key);
    }

    // If something changed from the screen key handler, stop.
    if (self.grabKeys !== grabKeys || self.lockKeys) {
      return;
    }

    if (focused && focused.keyable) {
      focused.emit('keypress', ch, key);
      focused.emit('key ' + key.full, ch, key);
    }
  });
};

Screen.prototype.enableKeys = function(el) {
  this._listenKeys(el);
};

Screen.prototype.enableInput = function(el) {
  this._listenMouse(el);
  this._listenKeys(el);
};

Screen.prototype._initHover = function() {
  var self = this;

  if (this._hoverText) {
    return;
  }

  this._hoverText = new Box({
    screen: this,
    left: 0,
    top: 0,
    tags: false,
    height: 'shrink',
    width: 'shrink',
    border: 'line',
    style: {
      border: {
        fg: 'default'
      },
      bg: 'default',
      fg: 'default'
    }
  });

  this.on('mousemove', function(data) {
    if (self._hoverText.detached) return;
    self._hoverText.rleft = data.x + 1;
    self._hoverText.rtop = data.y;
    self.render();
  });

  this.on('element mouseover', function(el, data) {
    if (!el._hoverOptions) return;
    self._hoverText.parseTags = el.parseTags;
    self._hoverText.setContent(el._hoverOptions.text);
    self.append(self._hoverText);
    self._hoverText.rleft = data.x + 1;
    self._hoverText.rtop = data.y;
    self.render();
  });

  this.on('element mouseout', function() {
    if (self._hoverText.detached) return;
    self._hoverText.detach();
    self.render();
  });

  // XXX This can cause problems if the
  // terminal does not support allMotion.
  // Workaround: check to see if content is set.
  this.on('element mouseup', function(el) {
    if (!self._hoverText.getContent()) return;
    if (!el._hoverOptions) return;
    self.append(self._hoverText);
    self.render();
  });
};

Screen.prototype.__defineGetter__('cols', function() {
  return this.program.cols;
});

Screen.prototype.__defineGetter__('rows', function() {
  return this.program.rows;
});

Screen.prototype.__defineGetter__('width', function() {
  return this.program.cols;
});

Screen.prototype.__defineGetter__('height', function() {
  return this.program.rows;
});

Screen.prototype.alloc = function(dirty) {
  var x, y;

  this.lines = [];
  for (y = 0; y < this.rows; y++) {
    this.lines[y] = [];
    for (x = 0; x < this.cols; x++) {
      this.lines[y][x] = [this.dattr, ' '];
    }
    this.lines[y].dirty = !!dirty;
  }

  this.olines = [];
  for (y = 0; y < this.rows; y++) {
    this.olines[y] = [];
    for (x = 0; x < this.cols; x++) {
      this.olines[y][x] = [this.dattr, ' '];
    }
  }

  this.program.clear();
};

Screen.prototype.realloc = function() {
  return this.alloc(true);
};

Screen.prototype.render = function() {
  var self = this;

  if (this.destroyed) return;

  this.emit('prerender');

  this._borderStops = {};

  // TODO: Possibly get rid of .dirty altogether.
  // TODO: Could possibly drop .dirty and just clear the `lines` buffer every
  // time before a screen.render. This way clearRegion doesn't have to be
  // called in arbitrary places for the sake of clearing a spot where an
  // element used to be (e.g. when an element moves or is hidden). There could
  // be some overhead though.
  // this.screen.clearRegion(0, this.cols, 0, this.rows);
  this._ci = 0;
  this.children.forEach(function(el) {
    el.index = self._ci++;
    //el._rendering = true;
    el.render();
    //el._rendering = false;
  });
  this._ci = -1;

  if (this.screen.dockBorders) {
    this._dockBorders();
  }

  this.draw(0, this.lines.length - 1);

  // XXX Workaround to deal with cursor pos before the screen has rendered and
  // lpos is not reliable (stale).
  if (this.focused && this.focused._updateCursor) {
    this.focused._updateCursor(true);
  }

  this.renders++;

  this.emit('render');
};

Screen.prototype.blankLine = function(ch, dirty) {
  var out = [];
  for (var x = 0; x < this.cols; x++) {
    out[x] = [this.dattr, ch || ' '];
  }
  out.dirty = dirty;
  return out;
};

Screen.prototype.insertLine = function(n, y, top, bottom) {
  // if (y === top) return this.insertLineNC(n, y, top, bottom);

  if (!this.tput.strings.change_scroll_region
      || !this.tput.strings.delete_line
      || !this.tput.strings.insert_line) return;

  this._buf += this.tput.csr(top, bottom);
  this._buf += this.tput.cup(y, 0);
  this._buf += this.tput.il(n);
  this._buf += this.tput.csr(0, this.height - 1);

  var j = bottom + 1;

  while (n--) {
    this.lines.splice(y, 0, this.blankLine());
    this.lines.splice(j, 1);
    this.olines.splice(y, 0, this.blankLine());
    this.olines.splice(j, 1);
  }
};

Screen.prototype.deleteLine = function(n, y, top, bottom) {
  // if (y === top) return this.deleteLineNC(n, y, top, bottom);

  if (!this.tput.strings.change_scroll_region
      || !this.tput.strings.delete_line
      || !this.tput.strings.insert_line) return;

  this._buf += this.tput.csr(top, bottom);
  this._buf += this.tput.cup(y, 0);
  this._buf += this.tput.dl(n);
  this._buf += this.tput.csr(0, this.height - 1);

  var j = bottom + 1;

  while (n--) {
    this.lines.splice(j, 0, this.blankLine());
    this.lines.splice(y, 1);
    this.olines.splice(j, 0, this.blankLine());
    this.olines.splice(y, 1);
  }
};

// This is how ncurses does it.
// Scroll down (up cursor-wise).
// This will only work for top line deletion as opposed to arbitrary lines.
Screen.prototype.insertLineNC = function(n, y, top, bottom) {
  if (!this.tput.strings.change_scroll_region
      || !this.tput.strings.delete_line) return;

  this._buf += this.tput.csr(top, bottom);
  this._buf += this.tput.cup(top, 0);
  this._buf += this.tput.dl(n);
  this._buf += this.tput.csr(0, this.height - 1);

  var j = bottom + 1;

  while (n--) {
    this.lines.splice(j, 0, this.blankLine());
    this.lines.splice(y, 1);
    this.olines.splice(j, 0, this.blankLine());
    this.olines.splice(y, 1);
  }
};

// This is how ncurses does it.
// Scroll up (down cursor-wise).
// This will only work for bottom line deletion as opposed to arbitrary lines.
Screen.prototype.deleteLineNC = function(n, y, top, bottom) {
  if (!this.tput.strings.change_scroll_region
      || !this.tput.strings.delete_line) return;

  this._buf += this.tput.csr(top, bottom);
  this._buf += this.tput.cup(bottom, 0);
  this._buf += Array(n + 1).join('\n');
  this._buf += this.tput.csr(0, this.height - 1);

  var j = bottom + 1;

  while (n--) {
    this.lines.splice(j, 0, this.blankLine());
    this.lines.splice(y, 1);
    this.olines.splice(j, 0, this.blankLine());
    this.olines.splice(y, 1);
  }
};

Screen.prototype.insertBottom = function(top, bottom) {
  return this.deleteLine(1, top, top, bottom);
};

Screen.prototype.insertTop = function(top, bottom) {
  return this.insertLine(1, top, top, bottom);
};

Screen.prototype.deleteBottom = function(top, bottom) {
  return this.clearRegion(0, this.width, bottom, bottom);
};

Screen.prototype.deleteTop = function(top, bottom) {
  // Same as: return this.insertBottom(top, bottom);
  return this.deleteLine(1, top, top, bottom);
};

// Parse the sides of an element to determine
// whether an element has uniform cells on
// both sides. If it does, we can use CSR to
// optimize scrolling on a scrollable element.
// Not exactly sure how worthwile this is.
// This will cause a performance/cpu-usage hit,
// but will it be less or greater than the
// performance hit of slow-rendering scrollable
// boxes with clean sides?
Screen.prototype.cleanSides = function(el) {
  var pos = el.lpos;

  if (!pos) {
    return false;
  }

  if (pos._cleanSides != null) {
    return pos._cleanSides;
  }

  if (pos.xi <= 0 && pos.xl >= this.width) {
    return pos._cleanSides = true;
  }

  if (this.options.fastCSR) {
    // Maybe just do this instead of parsing.
    if (pos.yi < 0) return pos._cleanSides = false;
    if (pos.yl > this.height) return pos._cleanSides = false;
    if (this.width - (pos.xl - pos.xi) < 40) {
      return pos._cleanSides = true;
    }
    return pos._cleanSides = false;
  }

  if (!this.options.smartCSR) {
    return false;
  }

  // The scrollbar can't update properly, and there's also a
  // chance that the scrollbar may get moved around senselessly.
  // NOTE: In pratice, this doesn't seem to be the case.
  // if (this.scrollbar) {
  //   return pos._cleanSides = false;
  // }

  // Doesn't matter if we're only a height of 1.
  // if ((pos.yl - el.ibottom) - (pos.yi + el.itop) <= 1) {
  //   return pos._cleanSides = false;
  // }

  var yi = pos.yi + el.itop
    , yl = pos.yl - el.ibottom
    , first
    , ch
    , x
    , y;

  if (pos.yi < 0) return pos._cleanSides = false;
  if (pos.yl > this.height) return pos._cleanSides = false;
  if (pos.xi - 1 < 0) return pos._cleanSides = true;
  if (pos.xl > this.width) return pos._cleanSides = true;

  for (x = pos.xi - 1; x >= 0; x--) {
    if (!this.olines[yi]) break;
    first = this.olines[yi][x];
    for (y = yi; y < yl; y++) {
      if (!this.olines[y] || !this.olines[y][x]) break;
      ch = this.olines[y][x];
      if (ch[0] !== first[0] || ch[1] !== first[1]) {
        return pos._cleanSides = false;
      }
    }
  }

  for (x = pos.xl; x < this.width; x++) {
    if (!this.olines[yi]) break;
    first = this.olines[yi][x];
    for (y = yi; y < yl; y++) {
      if (!this.olines[y] || !this.olines[y][x]) break;
      ch = this.olines[y][x];
      if (ch[0] !== first[0] || ch[1] !== first[1]) {
        return pos._cleanSides = false;
      }
    }
  }

  return pos._cleanSides = true;
};

Screen.prototype._dockBorders = function() {
  var lines = this.lines
    , stops = this._borderStops
    , i
    , y
    , x
    , ch;

  // var keys, stop;
  //
  // keys = Object.keys(this._borderStops)
  //   .map(function(k) { return +k; })
  //   .sort(function(a, b) { return a - b; });
  //
  // for (i = 0; i < keys.length; i++) {
  //   y = keys[i];
  //   if (!lines[y]) continue;
  //   stop = this._borderStops[y];
  //   for (x = stop.xi; x < stop.xl; x++) {

  stops = Object.keys(stops)
    .map(function(k) { return +k; })
    .sort(function(a, b) { return a - b; });

  for (i = 0; i < stops.length; i++) {
    y = stops[i];
    if (!lines[y]) continue;
    for (x = 0; x < this.width; x++) {
      ch = lines[y][x][1];
      if (angles[ch]) {
        lines[y][x][1] = this._getAngle(lines, x, y);
        lines[y].dirty = true;
      }
    }
  }
};

Screen.prototype._getAngle = function(lines, x, y) {
  var angle = 0
    , attr = lines[y][x][0]
    , ch = lines[y][x][1];

  if (lines[y][x - 1] && langles[lines[y][x - 1][1]]) {
    if (!this.options.ignoreDockContrast) {
      if (lines[y][x - 1][0] !== attr) return ch;
    }
    angle |= 1 << 3;
  }

  if (lines[y - 1] && uangles[lines[y - 1][x][1]]) {
    if (!this.options.ignoreDockContrast) {
      if (lines[y - 1][x][0] !== attr) return ch;
    }
    angle |= 1 << 2;
  }

  if (lines[y][x + 1] && rangles[lines[y][x + 1][1]]) {
    if (!this.options.ignoreDockContrast) {
      if (lines[y][x + 1][0] !== attr) return ch;
    }
    angle |= 1 << 1;
  }

  if (lines[y + 1] && dangles[lines[y + 1][x][1]]) {
    if (!this.options.ignoreDockContrast) {
      if (lines[y + 1][x][0] !== attr) return ch;
    }
    angle |= 1 << 0;
  }

  // Experimental: fixes this situation:
  // +----------+
  //            | <-- empty space here, should be a T angle
  // +-------+  |
  // |       |  |
  // +-------+  |
  // |          |
  // +----------+
  // if (uangles[lines[y][x][1]]) {
  //   if (lines[y + 1] && cdangles[lines[y + 1][x][1]]) {
  //     if (!this.options.ignoreDockContrast) {
  //       if (lines[y + 1][x][0] !== attr) return ch;
  //     }
  //     angle |= 1 << 0;
  //   }
  // }

  return angleTable[angle] || ch;
};

Screen.prototype.draw = function(start, end) {
  // this.emit('predraw');

  var x
    , y
    , line
    , out
    , ch
    , data
    , attr
    , fg
    , bg
    , flags;

  var main = ''
    , pre
    , post;

  var clr
    , neq
    , xx;

  var lx = -1
    , ly = -1
    , o;

  var acs;

  if (this._buf) {
    main += this._buf;
    this._buf = '';
  }

  for (y = start; y <= end; y++) {
    line = this.lines[y];
    o = this.olines[y];

    if (!line.dirty && !(this.cursor.artificial && y === this.program.y)) {
      continue;
    }
    line.dirty = false;

    out = '';
    attr = this.dattr;

    for (x = 0; x < line.length; x++) {
      data = line[x][0];
      ch = line[x][1];

      // Render the artificial cursor.
      if (this.cursor.artificial
          && !this.cursor._hidden
          && this.cursor._state
          && x === this.program.x
          && y === this.program.y) {
        var cattr = this._cursorAttr(this.cursor, data);
        if (cattr.ch) ch = cattr.ch;
        data = cattr.attr;
      }

      // Take advantage of xterm's back_color_erase feature by using a
      // lookahead. Stop spitting out so many damn spaces. NOTE: Is checking
      // the bg for non BCE terminals worth the overhead?
      if (this.options.useBCE
          && ch === ' '
          && (this.tput.bools.back_color_erase
          || (data & 0x1ff) === (this.dattr & 0x1ff))
          && ((data >> 18) & 8) === ((this.dattr >> 18) & 8)) {
        clr = true;
        neq = false;

        for (xx = x; xx < line.length; xx++) {
          if (line[xx][0] !== data || line[xx][1] !== ' ') {
            clr = false;
            break;
          }
          if (line[xx][0] !== o[xx][0] || line[xx][1] !== o[xx][1]) {
            neq = true;
          }
        }

        if (clr && neq) {
          lx = -1, ly = -1;
          if (data !== attr) {
            out += this.codeAttr(data);
            attr = data;
          }
          out += this.tput.cup(y, x);
          out += this.tput.el();
          for (xx = x; xx < line.length; xx++) {
            o[xx][0] = data;
            o[xx][1] = ' ';
          }
          break;
        }

        // If there's more than 10 spaces, use EL regardless
        // and start over drawing the rest of line. Might
        // not be worth it. Try to use ECH if the terminal
        // supports it. Maybe only try to use ECH here.
        // //if (this.tput.strings.erase_chars)
        // if (!clr && neq && (xx - x) > 10) {
        //   lx = -1, ly = -1;
        //   if (data !== attr) {
        //     out += this.codeAttr(data);
        //     attr = data;
        //   }
        //   out += this.tput.cup(y, x);
        //   if (this.tput.strings.erase_chars) {
        //     // Use erase_chars to avoid erasing the whole line.
        //     out += this.tput.ech(xx - x);
        //   } else {
        //     out += this.tput.el();
        //   }
        //   if (this.tput.strings.parm_right_cursor) {
        //     out += this.tput.cuf(xx - x);
        //   } else {
        //     out += this.tput.cup(y, xx);
        //   }
        //   this.fillRegion(data, ' ',
        //     x, this.tput.strings.erase_chars ? xx : line.length,
        //     y, y + 1);
        //   x = xx - 1;
        //   continue;
        // }

        // Skip to the next line if the
        // rest of the line is already drawn.
        // if (!neq) {
        //   for (; xx < line.length; xx++) {
        //     if (line[xx][0] !== o[xx][0] || line[xx][1] !== o[xx][1]) {
        //       neq = true;
        //       break;
        //     }
        //   }
        //   if (!neq) {
        //     attr = data;
        //     break;
        //   }
        // }
      }

      // Optimize by comparing the real output
      // buffer to the pending output buffer.
      if (data === o[x][0] && ch === o[x][1]) {
        if (lx === -1) {
          lx = x;
          ly = y;
        }
        continue;
      } else if (lx !== -1) {
        if (this.tput.strings.parm_right_cursor) {
          out += y === ly
            ? this.tput.cuf(x - lx)
            : this.tput.cup(y, x);
        } else {
          out += this.tput.cup(y, x);
        }
        lx = -1, ly = -1;
      }
      o[x][0] = data;
      o[x][1] = ch;

      if (data !== attr) {
        if (attr !== this.dattr) {
          out += '\x1b[m';
        }
        if (data !== this.dattr) {
          out += '\x1b[';

          bg = data & 0x1ff;
          fg = (data >> 9) & 0x1ff;
          flags = data >> 18;

          // bold
          if (flags & 1) {
            out += '1;';
          }

          // underline
          if (flags & 2) {
            out += '4;';
          }

          // blink
          if (flags & 4) {
            out += '5;';
          }

          // inverse
          if (flags & 8) {
            out += '7;';
          }

          // invisible
          if (flags & 16) {
            out += '8;';
          }

          if (bg !== 0x1ff) {
            bg = this._reduceColor(bg);
            if (bg < 16) {
              if (bg < 8) {
                bg += 40;
              } else if (bg < 16) {
                bg -= 8;
                bg += 100;
              }
              out += bg + ';';
            } else {
              out += '48;5;' + bg + ';';
            }
          }

          if (fg !== 0x1ff) {
            fg = this._reduceColor(fg);
            if (fg < 16) {
              if (fg < 8) {
                fg += 30;
              } else if (fg < 16) {
                fg -= 8;
                fg += 90;
              }
              out += fg + ';';
            } else {
              out += '38;5;' + fg + ';';
            }
          }

          if (out[out.length - 1] === ';') out = out.slice(0, -1);

          out += 'm';
        }
      }

      // If we find a double-width char, eat the next character which should be
      // a space due to parseContent's behavior.
      if (this.fullUnicode) {
        // If this is a surrogate pair double-width char, we can ignore it
        // because parseContent already counted it as length=2.
        if (unicode.charWidth(line[x][1]) === 2) {
          // NOTE: At cols=44, the bug that is avoided
          // by the angles check occurs in widget-unicode:
          // Might also need: `line[x + 1][0] !== line[x][0]`
          // for borderless boxes?
          if (x === line.length - 1 || angles[line[x + 1][1]]) {
            // If we're at the end, we don't have enough space for a
            // double-width. Overwrite it with a space and ignore.
            ch = ' ';
            o[x][1] = '\0';
          } else {
            // ALWAYS refresh double-width chars because this special cursor
            // behavior is needed. There may be a more efficient way of doing
            // this. See above.
            o[x][1] = '\0';
            // Eat the next character by moving forward and marking as a
            // space (which it is).
            o[++x][1] = '\0';
          }
        }
      }

      // Attempt to use ACS for supported characters.
      // This is not ideal, but it's how ncurses works.
      // There are a lot of terminals that support ACS
      // *and UTF8, but do not declare U8. So ACS ends
      // up being used (slower than utf8). Terminals
      // that do not support ACS and do not explicitly
      // support UTF8 get their unicode characters
      // replaced with really ugly ascii characters.
      // It is possible there is a terminal out there
      // somewhere that does not support ACS, but
      // supports UTF8, but I imagine it's unlikely.
      // Maybe remove !this.tput.unicode check, however,
      // this seems to be the way ncurses does it.
      if (this.tput.strings.enter_alt_charset_mode
          && !this.tput.brokenACS && (this.tput.acscr[ch] || acs)) {
        // Fun fact: even if this.tput.brokenACS wasn't checked here,
        // the linux console would still work fine because the acs
        // table would fail the check of: this.tput.acscr[ch]
        if (this.tput.acscr[ch]) {
          if (acs) {
            ch = this.tput.acscr[ch];
          } else {
            ch = this.tput.smacs()
              + this.tput.acscr[ch];
            acs = true;
          }
        } else if (acs) {
          ch = this.tput.rmacs() + ch;
          acs = false;
        }
      } else {
        // U8 is not consistently correct. Some terminfo's
        // terminals that do not declare it may actually
        // support utf8 (e.g. urxvt), but if the terminal
        // does not declare support for ACS (and U8), chances
        // are it does not support UTF8. This is probably
        // the "safest" way to do this. Should fix things
        // like sun-color.
        // NOTE: It could be the case that the $LANG
        // is all that matters in some cases:
        // if (!this.tput.unicode && ch > '~') {
        if (!this.tput.unicode && this.tput.numbers.U8 !== 1 && ch > '~') {
          ch = this.tput.utoa[ch] || '?';
        }
      }

      out += ch;
      attr = data;
    }

    if (attr !== this.dattr) {
      out += '\x1b[m';
    }

    if (out) {
      main += this.tput.cup(y, 0) + out;
    }
  }

  if (acs) {
    main += this.tput.rmacs();
    acs = false;
  }

  if (main) {
    pre = '';
    post = '';

    pre += this.tput.sc();
    post += this.tput.rc();

    if (!this.program.cursorHidden) {
      pre += this.tput.civis();
      post += this.tput.cnorm();
    }

    // this.program.flush();
    // this.program._owrite(pre + main + post);
    this.program._write(pre + main + post);
  }

  // this.emit('draw');
};

Screen.prototype._reduceColor = function(color) {
  return colors.reduce(color, this.tput.colors);
};

// Convert an SGR string to our own attribute format.
Screen.prototype.attrCode = function(code, cur, def) {
  var flags = (cur >> 18) & 0x1ff
    , fg = (cur >> 9) & 0x1ff
    , bg = cur & 0x1ff
    , c
    , i;

  code = code.slice(2, -1).split(';');
  if (!code[0]) code[0] = '0';

  for (i = 0; i < code.length; i++) {
    c = +code[i] || 0;
    switch (c) {
      case 0: // normal
        bg = def & 0x1ff;
        fg = (def >> 9) & 0x1ff;
        flags = (def >> 18) & 0x1ff;
        break;
      case 1: // bold
        flags |= 1;
        break;
      case 22:
        flags = (def >> 18) & 0x1ff;
        break;
      case 4: // underline
        flags |= 2;
        break;
      case 24:
        flags = (def >> 18) & 0x1ff;
        break;
      case 5: // blink
        flags |= 4;
        break;
      case 25:
        flags = (def >> 18) & 0x1ff;
        break;
      case 7: // inverse
        flags |= 8;
        break;
      case 27:
        flags = (def >> 18) & 0x1ff;
        break;
      case 8: // invisible
        flags |= 16;
        break;
      case 28:
        flags = (def >> 18) & 0x1ff;
        break;
      case 39: // default fg
        fg = (def >> 9) & 0x1ff;
        break;
      case 49: // default bg
        bg = def & 0x1ff;
        break;
      case 100: // default fg/bg
        fg = (def >> 9) & 0x1ff;
        bg = def & 0x1ff;
        break;
      default: // color
        if (c === 48 && +code[i+1] === 5) {
          i += 2;
          bg = +code[i];
          break;
        } else if (c === 48 && +code[i+1] === 2) {
          i += 2;
          bg = colors.match(+code[i], +code[i+1], +code[i+2]);
          if (bg === -1) bg = def & 0x1ff;
          i += 2;
          break;
        } else if (c === 38 && +code[i+1] === 5) {
          i += 2;
          fg = +code[i];
          break;
        } else if (c === 38 && +code[i+1] === 2) {
          i += 2;
          fg = colors.match(+code[i], +code[i+1], +code[i+2]);
          if (fg === -1) fg = (def >> 9) & 0x1ff;
          i += 2;
          break;
        }
        if (c >= 40 && c <= 47) {
          bg = c - 40;
        } else if (c >= 100 && c <= 107) {
          bg = c - 100;
          bg += 8;
        } else if (c === 49) {
          bg = def & 0x1ff;
        } else if (c >= 30 && c <= 37) {
          fg = c - 30;
        } else if (c >= 90 && c <= 97) {
          fg = c - 90;
          fg += 8;
        } else if (c === 39) {
          fg = (def >> 9) & 0x1ff;
        } else if (c === 100) {
          fg = (def >> 9) & 0x1ff;
          bg = def & 0x1ff;
        }
        break;
    }
  }

  return (flags << 18) | (fg << 9) | bg;
};

// Convert our own attribute format to an SGR string.
Screen.prototype.codeAttr = function(code) {
  var flags = (code >> 18) & 0x1ff
    , fg = (code >> 9) & 0x1ff
    , bg = code & 0x1ff
    , out = '';

  // bold
  if (flags & 1) {
    out += '1;';
  }

  // underline
  if (flags & 2) {
    out += '4;';
  }

  // blink
  if (flags & 4) {
    out += '5;';
  }

  // inverse
  if (flags & 8) {
    out += '7;';
  }

  // invisible
  if (flags & 16) {
    out += '8;';
  }

  if (bg !== 0x1ff) {
    bg = this._reduceColor(bg);
    if (bg < 16) {
      if (bg < 8) {
        bg += 40;
      } else if (bg < 16) {
        bg -= 8;
        bg += 100;
      }
      out += bg + ';';
    } else {
      out += '48;5;' + bg + ';';
    }
  }

  if (fg !== 0x1ff) {
    fg = this._reduceColor(fg);
    if (fg < 16) {
      if (fg < 8) {
        fg += 30;
      } else if (fg < 16) {
        fg -= 8;
        fg += 90;
      }
      out += fg + ';';
    } else {
      out += '38;5;' + fg + ';';
    }
  }

  if (out[out.length - 1] === ';') out = out.slice(0, -1);

  return '\x1b[' + out + 'm';
};

Screen.prototype.focusOffset = function(offset) {
  var shown = this.keyable.filter(function(el) {
    return !el.detached && el.visible;
  }).length;

  if (!shown || !offset) {
    return;
  }

  var i = this.keyable.indexOf(this.focused);
  if (!~i) return;

  if (offset > 0) {
    while (offset--) {
      if (++i > this.keyable.length - 1) i = 0;
      if (this.keyable[i].detached || !this.keyable[i].visible) offset++;
    }
  } else {
    offset = -offset;
    while (offset--) {
      if (--i < 0) i = this.keyable.length - 1;
      if (this.keyable[i].detached || !this.keyable[i].visible) offset++;
    }
  }

  return this.keyable[i].focus();
};

Screen.prototype.focusPrev =
Screen.prototype.focusPrevious = function() {
  return this.focusOffset(-1);
};

Screen.prototype.focusNext = function() {
  return this.focusOffset(1);
};

Screen.prototype.focusPush = function(el) {
  if (!el) return;
  var old = this.history[this.history.length - 1];
  if (this.history.length === 10) {
    this.history.shift();
  }
  this.history.push(el);
  this._focus(el, old);
};

Screen.prototype.focusPop = function() {
  var old = this.history.pop();
  if (this.history.length) {
    this._focus(this.history[this.history.length - 1], old);
  }
  return old;
};

Screen.prototype.saveFocus = function() {
  return this._savedFocus = this.focused;
};

Screen.prototype.restoreFocus = function() {
  if (!this._savedFocus) return;
  this._savedFocus.focus();
  delete this._savedFocus;
  return this.focused;
};

Screen.prototype.rewindFocus = function() {
  var old = this.history.pop()
    , el;

  while (this.history.length) {
    el = this.history.pop();
    if (!el.detached && el.visible) {
      this.history.push(el);
      this._focus(el, old);
      return el;
    }
  }

  if (old) {
    old.emit('blur');
  }
};

Screen.prototype._focus = function(self, old) {
  // Find a scrollable ancestor if we have one.
  var el = self;
  while (el = el.parent) {
    if (el.scrollable) break;
  }

  // If we're in a scrollable element,
  // automatically scroll to the focused element.
  if (el && !el.detached) {
    // NOTE: This is different from the other "visible" values - it needs the
    // visible height of the scrolling element itself, not the element within
    // it.
    var visible = self.screen.height - el.atop - el.itop - el.abottom - el.ibottom;
    if (self.rtop < el.childBase) {
      el.scrollTo(self.rtop);
      self.screen.render();
    } else if (self.rtop + self.height - self.ibottom > el.childBase + visible) {
      // Explanation for el.itop here: takes into account scrollable elements
      // with borders otherwise the element gets covered by the bottom border:
      el.scrollTo(self.rtop - (el.height - self.height) + el.itop, true);
      self.screen.render();
    }
  }

  if (old) {
    old.emit('blur', self);
  }

  self.emit('focus', old);
};

Screen.prototype.__defineGetter__('focused', function() {
  return this.history[this.history.length - 1];
});

Screen.prototype.__defineSetter__('focused', function(el) {
  return this.focusPush(el);
});

Screen.prototype.clearRegion = function(xi, xl, yi, yl, override) {
  return this.fillRegion(this.dattr, ' ', xi, xl, yi, yl, override);
};

Screen.prototype.fillRegion = function(attr, ch, xi, xl, yi, yl, override) {
  var lines = this.lines
    , cell
    , xx;

  if (xi < 0) xi = 0;
  if (yi < 0) yi = 0;

  for (; yi < yl; yi++) {
    if (!lines[yi]) break;
    for (xx = xi; xx < xl; xx++) {
      cell = lines[yi][xx];
      if (!cell) break;
      if (override || attr !== cell[0] || ch !== cell[1]) {
        lines[yi][xx][0] = attr;
        lines[yi][xx][1] = ch;
        lines[yi].dirty = true;
      }
    }
  }
};

Screen.prototype.key = function() {
  return this.program.key.apply(this, arguments);
};

Screen.prototype.onceKey = function() {
  return this.program.onceKey.apply(this, arguments);
};

Screen.prototype.unkey =
Screen.prototype.removeKey = function() {
  return this.program.unkey.apply(this, arguments);
};

Screen.prototype.spawn = function(file, args, options) {
  if (!Array.isArray(args)) {
    options = args;
    args = [];
  }

  var screen = this
    , program = screen.program
    , spawn = require('child_process').spawn
    , mouse = program.mouseEnabled
    , ps;

  options = options || {};

  options.stdio = options.stdio || 'inherit';

  program.lsaveCursor('spawn');
  // program.csr(0, program.rows - 1);
  program.normalBuffer();
  program.showCursor();
  if (mouse) program.disableMouse();

  var write = program.output.write;
  program.output.write = function() {};
  program.input.pause();
  if (program.input.setRawMode) {
    program.input.setRawMode(false);
  }

  var resume = function() {
    if (resume.done) return;
    resume.done = true;

    if (program.input.setRawMode) {
      program.input.setRawMode(true);
    }
    program.input.resume();
    program.output.write = write;

    program.alternateBuffer();
    // program.csr(0, program.rows - 1);
    if (mouse) {
      program.enableMouse();
      if (screen.options.sendFocus) {
        screen.program.setMouse({ sendFocus: true }, true);
      }
    }

    screen.alloc();
    screen.render();

    screen.program.lrestoreCursor('spawn', true);
  };

  ps = spawn(file, args, options);

  ps.on('error', resume);

  ps.on('exit', resume);

  return ps;
};

Screen.prototype.exec = function(file, args, options, callback) {
  var ps = this.spawn(file, args, options);

  ps.on('error', function(err) {
    if (!callback) return;
    return callback(err, false);
  });

  ps.on('exit', function(code) {
    if (!callback) return;
    return callback(null, code === 0);
  });

  return ps;
};

Screen.prototype.readEditor = function(options, callback) {
  if (typeof options === 'string') {
    options = { editor: options };
  }

  if (!callback) {
    callback = options;
    options = null;
  }

  if (!callback) {
    callback = function() {};
  }

  options = options || {};

  var self = this
    , editor = options.editor || process.env.EDITOR || 'vi'
    , name = options.name || process.title || 'blessed'
    , rnd = Math.random().toString(36).split('.').pop()
    , file = '/tmp/' + name + '.' + rnd
    , args = [file]
    , opt;

  opt = {
    stdio: 'inherit',
    env: process.env,
    cwd: process.env.HOME
  };

  function writeFile(callback) {
    if (!options.value) return callback();
    return fs.writeFile(file, options.value, callback);
  }

  return writeFile(function(err) {
    if (err) return callback(err);
    return self.exec(editor, args, opt, function(err, success) {
      if (err) return callback(err);
      return fs.readFile(file, 'utf8', function(err, data) {
        return fs.unlink(file, function() {
          if (!success) return callback(new Error('Unsuccessful.'));
          if (err) return callback(err);
          return callback(null, data);
        });
      });
    });
  });
};

Screen.prototype.displayImage = function(file, callback) {
  if (!file) {
    if (!callback) return;
    return callback(new Error('No image.'));
  }

  file = path.resolve(process.cwd(), file);

  if (!~file.indexOf('://')) {
    file = 'file://' + file;
  }

  var args = ['w3m', '-T', 'text/html'];

  var input = '<title>press q to exit</title>'
    + '<img align="center" src="' + file + '">';

  var opt = {
    stdio: ['pipe', 1, 2],
    env: process.env,
    cwd: process.env.HOME
  };

  var ps = this.spawn(args[0], args.slice(1), opt);

  ps.on('error', function(err) {
    if (!callback) return;
    return callback(err);
  });

  ps.on('exit', function(code) {
    if (!callback) return;
    if (code !== 0) return callback(new Error('Exit Code: ' + code));
    return callback(null, code === 0);
  });

  ps.stdin.write(input + '\n');
  ps.stdin.end();
};

Screen.prototype.setEffects = function(el, fel, over, out, effects, temp) {
  if (!effects) return;

  var tmp = {};
  if (temp) el[temp] = tmp;

  if (typeof el !== 'function') {
    var _el = el;
    el = function() { return _el; };
  }

  fel.on(over, function() {
    var element = el();
    Object.keys(effects).forEach(function(key) {
      var val = effects[key];
      if (val !== null && typeof val === 'object') {
        tmp[key] = tmp[key] || {};
        // element.style[key] = element.style[key] || {};
        Object.keys(val).forEach(function(k) {
          var v = val[k];
          tmp[key][k] = element.style[key][k];
          element.style[key][k] = v;
        });
        return;
      }
      tmp[key] = element.style[key];
      element.style[key] = val;
    });
    element.screen.render();
  });

  fel.on(out, function() {
    var element = el();
    Object.keys(effects).forEach(function(key) {
      var val = effects[key];
      if (val !== null && typeof val === 'object') {
        tmp[key] = tmp[key] || {};
        // element.style[key] = element.style[key] || {};
        Object.keys(val).forEach(function(k) {
          if (tmp[key].hasOwnProperty(k)) {
            element.style[key][k] = tmp[key][k];
          }
        });
        return;
      }
      if (tmp.hasOwnProperty(key)) {
        element.style[key] = tmp[key];
      }
    });
    element.screen.render();
  });
};

Screen.prototype.sigtstp = function(callback) {
  var self = this;
  this.program.sigtstp(function() {
    self.alloc();
    self.render();
    self.program.lrestoreCursor('pause', true);
    if (callback) callback();
  });
};

Screen.prototype.copyToClipboard = function(text) {
  return this.program.copyToClipboard(text);
};

Screen.prototype.cursorShape = function(shape, blink) {
  var self = this;

  this.cursor.shape = shape || 'block';
  this.cursor.blink = blink || false;
  this.cursor._set = true;

  if (this.cursor.artificial) {
    if (!this.program.hideCursor_old) {
      var hideCursor = this.program.hideCursor;
      this.program.hideCursor_old = this.program.hideCursor;
      this.program.hideCursor = function() {
        hideCursor.call(self.program);
        self.cursor._hidden = true;
        if (self.renders) self.render();
      };
    }
    if (!this.program.showCursor_old) {
      var showCursor = this.program.showCursor;
      this.program.showCursor_old = this.program.showCursor;
      this.program.showCursor = function() {
        self.cursor._hidden = false;
        if (self.program._exiting) showCursor.call(self.program);
        if (self.renders) self.render();
      };
    }
    if (!this._cursorBlink) {
      this._cursorBlink = setInterval(function() {
        if (!self.cursor.blink) return;
        self.cursor._state ^= 1;
        if (self.renders) self.render();
      }, 500);
      if (this._cursorBlink.unref) {
        this._cursorBlink.unref();
      }
    }
    return true;
  }

  return this.program.cursorShape(this.cursor.shape, this.cursor.blink);
};

Screen.prototype.cursorColor = function(color) {
  this.cursor.color = color != null
    ? colors.convert(color)
    : null;
  this.cursor._set = true;

  if (this.cursor.artificial) {
    return true;
  }

  return this.program.cursorColor(colors.ncolors[this.cursor.color]);
};

Screen.prototype.cursorReset =
Screen.prototype.resetCursor = function() {
  this.cursor.shape = 'block';
  this.cursor.blink = false;
  this.cursor.color = null;
  this.cursor._set = false;

  if (this.cursor.artificial) {
    this.cursor.artificial = false;
    if (this.program.hideCursor_old) {
      this.program.hideCursor = this.program.hideCursor_old;
      delete this.program.hideCursor_old;
    }
    if (this.program.showCursor_old) {
      this.program.showCursor = this.program.showCursor_old;
      delete this.program.showCursor_old;
    }
    if (this._cursorBlink) {
      clearInterval(this._cursorBlink);
      delete this._cursorBlink;
    }
    return true;
  }

  return this.program.cursorReset();
};

Screen.prototype._cursorAttr = function(cursor, dattr) {
  var attr = dattr || this.dattr
    , cattr
    , ch;

  if (cursor.shape === 'line') {
    attr &= ~(0x1ff << 9);
    attr |= 7 << 9;
    ch = '\u2502';
  } else if (cursor.shape === 'underline') {
    attr &= ~(0x1ff << 9);
    attr |= 7 << 9;
    attr |= 2 << 18;
  } else if (cursor.shape === 'block') {
    attr &= ~(0x1ff << 9);
    attr |= 7 << 9;
    attr |= 8 << 18;
  } else if (typeof cursor.shape === 'object' && cursor.shape) {
    cattr = Element.prototype.sattr.call(cursor, cursor.shape);

    if (cursor.shape.bold || cursor.shape.underline
        || cursor.shape.blink || cursor.shape.inverse
        || cursor.shape.invisible) {
      attr &= ~(0x1ff << 18);
      attr |= ((cattr >> 18) & 0x1ff) << 18;
    }

    if (cursor.shape.fg) {
      attr &= ~(0x1ff << 9);
      attr |= ((cattr >> 9) & 0x1ff) << 9;
    }

    if (cursor.shape.bg) {
      attr &= ~(0x1ff << 0);
      attr |= cattr & 0x1ff;
    }

    if (cursor.shape.ch) {
      ch = cursor.shape.ch;
    }
  }

  if (cursor.color != null) {
    attr &= ~(0x1ff << 9);
    attr |= cursor.color << 9;
  }

  return {
    ch: ch,
    attr: attr
  };
};

Screen.prototype.screenshot = function(xi, xl, yi, yl, term) {
  if (xi == null) xi = 0;
  if (xl == null) xl = this.cols;
  if (yi == null) yi = 0;
  if (yl == null) yl = this.rows;

  if (xi < 0) xi = 0;
  if (yi < 0) yi = 0;

  var x
    , y
    , line
    , out
    , ch
    , data
    , attr;

  var sdattr = this.dattr;

  if (term) {
    this.dattr = term.defAttr;
  }

  var main = '';

  for (y = yi; y < yl; y++) {
    line = term
      ? term.lines[y]
      : this.lines[y];

    if (!line) break;

    out = '';
    attr = this.dattr;

    for (x = xi; x < xl; x++) {
      if (!line[x]) break;

      data = line[x][0];
      ch = line[x][1];

      if (data !== attr) {
        if (attr !== this.dattr) {
          out += '\x1b[m';
        }
        if (data !== this.dattr) {
          var _data = data;
          if (term) {
            if (((_data >> 9) & 0x1ff) === 257) _data |= 0x1ff << 9;
            if ((_data & 0x1ff) === 256) _data |= 0x1ff;
          }
          out += this.codeAttr(_data);
        }
      }

      if (this.fullUnicode) {
        if (unicode.charWidth(line[x][1]) === 2) {
          if (x === xl - 1) {
            ch = ' ';
          } else {
            x++;
          }
        }
      }

      out += ch;
      attr = data;
    }

    if (attr !== this.dattr) {
      out += '\x1b[m';
    }

    if (out) {
      main += (y > 0 ? '\n' : '') + out;
    }
  }

  main = main.replace(/(?:\s*\x1b\[40m\s*\x1b\[m\s*)*$/, '') + '\n';

  if (term) {
    this.dattr = sdattr;
  }

  return main;
};

/**
 * Positioning
 */

Screen.prototype._getPos = function() {
  return this;
};

/**
 * Angle Table
 */

var angles = {
  '\u2518': true, // '┘'
  '\u2510': true, // '┐'
  '\u250c': true, // '┌'
  '\u2514': true, // '└'
  '\u253c': true, // '┼'
  '\u251c': true, // '├'
  '\u2524': true, // '┤'
  '\u2534': true, // '┴'
  '\u252c': true, // '┬'
  '\u2502': true, // '│'
  '\u2500': true  // '─'
};

var langles = {
  '\u250c': true, // '┌'
  '\u2514': true, // '└'
  '\u253c': true, // '┼'
  '\u251c': true, // '├'
  '\u2534': true, // '┴'
  '\u252c': true, // '┬'
  '\u2500': true  // '─'
};

var uangles = {
  '\u2510': true, // '┐'
  '\u250c': true, // '┌'
  '\u253c': true, // '┼'
  '\u251c': true, // '├'
  '\u2524': true, // '┤'
  '\u252c': true, // '┬'
  '\u2502': true  // '│'
};

var rangles = {
  '\u2518': true, // '┘'
  '\u2510': true, // '┐'
  '\u253c': true, // '┼'
  '\u2524': true, // '┤'
  '\u2534': true, // '┴'
  '\u252c': true, // '┬'
  '\u2500': true  // '─'
};

var dangles = {
  '\u2518': true, // '┘'
  '\u2514': true, // '└'
  '\u253c': true, // '┼'
  '\u251c': true, // '├'
  '\u2524': true, // '┤'
  '\u2534': true, // '┴'
  '\u2502': true  // '│'
};

// var cdangles = {
//   '\u250c': true  // '┌'
// };

// Every ACS angle character can be
// represented by 4 bits ordered like this:
// [langle][uangle][rangle][dangle]
var angleTable = {
  '0000': '', // ?
  '0001': '\u2502', // '│' // ?
  '0010': '\u2500', // '─' // ??
  '0011': '\u250c', // '┌'
  '0100': '\u2502', // '│' // ?
  '0101': '\u2502', // '│'
  '0110': '\u2514', // '└'
  '0111': '\u251c', // '├'
  '1000': '\u2500', // '─' // ??
  '1001': '\u2510', // '┐'
  '1010': '\u2500', // '─' // ??
  '1011': '\u252c', // '┬'
  '1100': '\u2518', // '┘'
  '1101': '\u2524', // '┤'
  '1110': '\u2534', // '┴'
  '1111': '\u253c'  // '┼'
};

Object.keys(angleTable).forEach(function(key) {
  angleTable[parseInt(key, 2)] = angleTable[key];
  delete angleTable[key];
});

/**
 * Expose
 */

module.exports = Screen;
