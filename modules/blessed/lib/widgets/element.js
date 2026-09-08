/**
 * element.js - base element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

var assert = require('assert');

var colors = require('../colors')
  , unicode = require('../unicode');

var nextTick = global.setImmediate || process.nextTick.bind(process);

var helpers = require('../helpers');

var Node = require('./node');

/**
 * Element
 */

function Element(options) {
  var self = this;

  if (!(this instanceof Node)) {
    return new Element(options);
  }

  options = options || {};

  // Workaround to get a `scrollable` option.
  if (options.scrollable && !this._ignore && this.type !== 'scrollable-box') {
    var ScrollableBox = require('./scrollablebox');
    Object.getOwnPropertyNames(ScrollableBox.prototype).forEach(function(key) {
      if (key === 'type') return;
      Object.defineProperty(this, key,
        Object.getOwnPropertyDescriptor(ScrollableBox.prototype, key));
    }, this);
    this._ignore = true;
    ScrollableBox.call(this, options);
    delete this._ignore;
    return this;
  }

  Node.call(this, options);

  this.name = options.name;

  options.position = options.position || {
    left: options.left,
    right: options.right,
    top: options.top,
    bottom: options.bottom,
    width: options.width,
    height: options.height
  };

  if (options.position.width === 'shrink'
      || options.position.height === 'shrink') {
    if (options.position.width === 'shrink') {
      delete options.position.width;
    }
    if (options.position.height === 'shrink') {
      delete options.position.height;
    }
    options.shrink = true;
  }

  this.position = options.position;

  this.noOverflow = options.noOverflow;
  this.dockBorders = options.dockBorders;
  this.shadow = options.shadow;

  this.style = options.style;

  if (!this.style) {
    this.style = {};
    this.style.fg = options.fg;
    this.style.bg = options.bg;
    this.style.bold = options.bold;
    this.style.underline = options.underline;
    this.style.blink = options.blink;
    this.style.inverse = options.inverse;
    this.style.invisible = options.invisible;
    this.style.transparent = options.transparent;
  }

  this.hidden = options.hidden || false;
  this.fixed = options.fixed || false;
  this.align = options.align || 'left';
  this.valign = options.valign || 'top';
  this.wrap = options.wrap !== false;
  this.shrink = options.shrink;
  this.fixed = options.fixed;
  this.ch = options.ch || ' ';

  if (typeof options.padding === 'number' || !options.padding) {
    options.padding = {
      left: options.padding,
      top: options.padding,
      right: options.padding,
      bottom: options.padding
    };
  }

  this.padding = {
    left: options.padding.left || 0,
    top: options.padding.top || 0,
    right: options.padding.right || 0,
    bottom: options.padding.bottom || 0
  };

  this.border = options.border;
  if (this.border) {
    if (typeof this.border === 'string') {
      this.border = { type: this.border };
    }
    this.border.type = this.border.type || 'bg';
    if (this.border.type === 'ascii') this.border.type = 'line';
    this.border.ch = this.border.ch || ' ';
    this.style.border = this.style.border || this.border.style;
    if (!this.style.border) {
      this.style.border = {};
      this.style.border.fg = this.border.fg;
      this.style.border.bg = this.border.bg;
    }
    //this.border.style = this.style.border;
    if (this.border.left == null) this.border.left = true;
    if (this.border.top == null) this.border.top = true;
    if (this.border.right == null) this.border.right = true;
    if (this.border.bottom == null) this.border.bottom = true;
  }

  // if (options.mouse || options.clickable) {
  if (options.clickable) {
    this.screen._listenMouse(this);
  }

  if (options.input || options.keyable) {
    this.screen._listenKeys(this);
  }

  this.parseTags = options.parseTags || options.tags;

  this.setContent(options.content || '', true);

  if (options.label) {
    this.setLabel(options.label);
  }

  if (options.hoverText) {
    this.setHover(options.hoverText);
  }

  // TODO: Possibly move this to Node for onScreenEvent('mouse', ...).
  this.on('newListener', function fn(type) {
    // type = type.split(' ').slice(1).join(' ');
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
      self.screen._listenMouse(self);
    } else if (type === 'keypress' || type.indexOf('key ') === 0) {
      self.screen._listenKeys(self);
    }
  });

  this.on('resize', function() {
    self.parseContent();
  });

  this.on('attach', function() {
    self.parseContent();
  });

  this.on('detach', function() {
    delete self.lpos;
  });

  if (options.hoverBg != null) {
    options.hoverEffects = options.hoverEffects || {};
    options.hoverEffects.bg = options.hoverBg;
  }

  if (this.style.hover) {
    options.hoverEffects = this.style.hover;
  }

  if (this.style.focus) {
    options.focusEffects = this.style.focus;
  }

  if (options.effects) {
    if (options.effects.hover) options.hoverEffects = options.effects.hover;
    if (options.effects.focus) options.focusEffects = options.effects.focus;
  }

  [['hoverEffects', 'mouseover', 'mouseout', '_htemp'],
   ['focusEffects', 'focus', 'blur', '_ftemp']].forEach(function(props) {
    var pname = props[0], over = props[1], out = props[2], temp = props[3];
    self.screen.setEffects(self, self, over, out, self.options[pname], temp);
  });

  if (this.options.draggable) {
    this.draggable = true;
  }

  if (options.focused) {
    this.focus();
  }
}

Element.prototype.__proto__ = Node.prototype;

Element.prototype.type = 'element';

Element.prototype.__defineGetter__('focused', function() {
  return this.screen.focused === this;
});

Element.prototype.sattr = function(style, fg, bg) {
  var bold = style.bold
    , underline = style.underline
    , blink = style.blink
    , inverse = style.inverse
    , invisible = style.invisible;

  // if (arguments.length === 1) {
  if (fg == null && bg == null) {
    fg = style.fg;
    bg = style.bg;
  }

  // This used to be a loop, but I decided
  // to unroll it for performance's sake.
  if (typeof bold === 'function') bold = bold(this);
  if (typeof underline === 'function') underline = underline(this);
  if (typeof blink === 'function') blink = blink(this);
  if (typeof inverse === 'function') inverse = inverse(this);
  if (typeof invisible === 'function') invisible = invisible(this);

  if (typeof fg === 'function') fg = fg(this);
  if (typeof bg === 'function') bg = bg(this);

  // return (this.uid << 24)
  //   | ((this.dockBorders ? 32 : 0) << 18)
  return ((invisible ? 16 : 0) << 18)
    | ((inverse ? 8 : 0) << 18)
    | ((blink ? 4 : 0) << 18)
    | ((underline ? 2 : 0) << 18)
    | ((bold ? 1 : 0) << 18)
    | (colors.convert(fg) << 9)
    | colors.convert(bg);
};

Element.prototype.onScreenEvent = function(type, handler) {
  var listeners = this._slisteners = this._slisteners || [];
  listeners.push({ type: type, handler: handler });
  this.screen.on(type, handler);
};

Element.prototype.onceScreenEvent = function(type, handler) {
  var listeners = this._slisteners = this._slisteners || [];
  var entry = { type: type, handler: handler };
  listeners.push(entry);
  this.screen.once(type, function() {
    var i = listeners.indexOf(entry);
    if (~i) listeners.splice(i, 1);
    return handler.apply(this, arguments);
  });
};

Element.prototype.removeScreenEvent = function(type, handler) {
  var listeners = this._slisteners = this._slisteners || [];
  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    if (listener.type === type && listener.handler === handler) {
      listeners.splice(i, 1);
      if (this._slisteners.length === 0) {
        delete this._slisteners;
      }
      break;
    }
  }
  this.screen.removeListener(type, handler);
};

Element.prototype.free = function() {
  var listeners = this._slisteners = this._slisteners || [];
  for (var i = 0; i < listeners.length; i++) {
    var listener = listeners[i];
    this.screen.removeListener(listener.type, listener.handler);
  }
  delete this._slisteners;
};

Element.prototype.hide = function() {
  if (this.hidden) return;
  this.clearPos();
  this.hidden = true;
  this.emit('hide');
  if (this.screen.focused === this) {
    this.screen.rewindFocus();
  }
};

Element.prototype.show = function() {
  if (!this.hidden) return;
  this.hidden = false;
  this.emit('show');
};

Element.prototype.toggle = function() {
  return this.hidden ? this.show() : this.hide();
};

Element.prototype.focus = function() {
  return this.screen.focused = this;
};

Element.prototype.setContent = function(content, noClear, noTags) {
  if (!noClear) this.clearPos();
  this.content = content || '';
  this.parseContent(noTags);
  this.emit('set content');
};

Element.prototype.getContent = function() {
  if (!this._clines) return '';
  return this._clines.fake.join('\n');
};

Element.prototype.setText = function(content, noClear) {
  content = content || '';
  content = content.replace(/\x1b\[[\d;]*m/g, '');
  return this.setContent(content, noClear, true);
};

Element.prototype.getText = function() {
  return this.getContent().replace(/\x1b\[[\d;]*m/g, '');
};

Element.prototype.parseContent = function(noTags) {
  if (this.detached) return false;

  var width = this.width - this.iwidth;
  if (this._clines == null
      || this._clines.width !== width
      || this._clines.content !== this.content) {
    var content = this.content;

    content = content
      .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1a\x1c-\x1f\x7f]/g, '')
      .replace(/\x1b(?!\[[\d;]*m)/g, '')
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, this.screen.tabc);

    if (this.screen.fullUnicode) {
      // double-width chars will eat the next char after render. create a
      // blank character after it so it doesn't eat the real next char.
      content = content.replace(unicode.chars.all, '$1\x03');
      // iTerm2 cannot render combining characters properly.
      if (this.screen.program.isiTerm2) {
        content = content.replace(unicode.chars.combining, '');
      }
    } else {
      // no double-width: replace them with question-marks.
      content = content.replace(unicode.chars.all, '??');
      // delete combining characters since they're 0-width anyway.
      // NOTE: We could drop this, the non-surrogates would get changed to ? by
      // the unicode filter, and surrogates changed to ? by the surrogate
      // regex. however, the user might expect them to be 0-width.
      // NOTE: Might be better for performance to drop!
      content = content.replace(unicode.chars.combining, '');
      // no surrogate pairs: replace them with question-marks.
      content = content.replace(unicode.chars.surrogate, '?');
      // XXX Deduplicate code here:
      // content = helpers.dropUnicode(content);
    }

    if (!noTags) {
      content = this._parseTags(content);
    }

    this._clines = this._wrapContent(content, width);
    this._clines.width = width;
    this._clines.content = this.content;
    this._clines.attr = this._parseAttr(this._clines);
    this._clines.ci = [];
    this._clines.reduce(function(total, line) {
      this._clines.ci.push(total);
      return total + line.length + 1;
    }.bind(this), 0);

    this._pcontent = this._clines.join('\n');
    this.emit('parsed content');

    return true;
  }

  // Need to calculate this every time because the default fg/bg may change.
  this._clines.attr = this._parseAttr(this._clines) || this._clines.attr;

  return false;
};

// Convert `{red-fg}foo{/red-fg}` to `\x1b[31mfoo\x1b[39m`.
Element.prototype._parseTags = function(text) {
  if (!this.parseTags) return text;
  if (!/{\/?[\w\-,;!#]*}/.test(text)) return text;

  var program = this.screen.program
    , out = ''
    , state
    , bg = []
    , fg = []
    , flag = []
    , cap
    , slash
    , param
    , attr
    , esc;

  for (;;) {
    if (!esc && (cap = /^{escape}/.exec(text))) {
      text = text.substring(cap[0].length);
      esc = true;
      continue;
    }

    if (esc && (cap = /^([\s\S]+?){\/escape}/.exec(text))) {
      text = text.substring(cap[0].length);
      out += cap[1];
      esc = false;
      continue;
    }

    if (esc) {
      // throw new Error('Unterminated escape tag.');
      out += text;
      break;
    }

    if (cap = /^{(\/?)([\w\-,;!#]*)}/.exec(text)) {
      text = text.substring(cap[0].length);
      slash = cap[1] === '/';
      param = cap[2].replace(/-/g, ' ');

      if (param === 'open') {
        out += '{';
        continue;
      } else if (param === 'close') {
        out += '}';
        continue;
      }

      if (param.slice(-3) === ' bg') state = bg;
      else if (param.slice(-3) === ' fg') state = fg;
      else state = flag;

      if (slash) {
        if (!param) {
          out += program._attr('normal');
          bg.length = 0;
          fg.length = 0;
          flag.length = 0;
        } else {
          attr = program._attr(param, false);
          if (attr == null) {
            out += cap[0];
          } else {
            // if (param !== state[state.length - 1]) {
            //   throw new Error('Misnested tags.');
            // }
            state.pop();
            if (state.length) {
              out += program._attr(state[state.length - 1]);
            } else {
              out += attr;
            }
          }
        }
      } else {
        if (!param) {
          out += cap[0];
        } else {
          attr = program._attr(param);
          if (attr == null) {
            out += cap[0];
          } else {
            state.push(param);
            out += attr;
          }
        }
      }

      continue;
    }

    if (cap = /^[\s\S]+?(?={\/?[\w\-,;!#]*})/.exec(text)) {
      text = text.substring(cap[0].length);
      out += cap[0];
      continue;
    }

    out += text;
    break;
  }

  return out;
};

Element.prototype._parseAttr = function(lines) {
  var dattr = this.sattr(this.style)
    , attr = dattr
    , attrs = []
    , line
    , i
    , j
    , c;

  if (lines[0].attr === attr) {
    return;
  }

  for (j = 0; j < lines.length; j++) {
    line = lines[j];
    attrs[j] = attr;
    for (i = 0; i < line.length; i++) {
      if (line[i] === '\x1b') {
        if (c = /^\x1b\[[\d;]*m/.exec(line.substring(i))) {
          attr = this.screen.attrCode(c[0], attr, dattr);
          i += c[0].length - 1;
        }
      }
    }
  }

  return attrs;
};

Element.prototype._align = function(line, width, align) {
  if (!align) return line;
  //if (!align && !~line.indexOf('{|}')) return line;

  var cline = line.replace(/\x1b\[[\d;]*m/g, '')
    , len = cline.length
    , s = width - len;

  if (this.shrink) {
    s = 0;
  }

  if (len === 0) return line;
  if (s < 0) return line;

  if (align === 'center') {
    s = Array(((s / 2) | 0) + 1).join(' ');
    return s + line + s;
  } else if (align === 'right') {
    s = Array(s + 1).join(' ');
    return s + line;
  } else if (this.parseTags && ~line.indexOf('{|}')) {
    var parts = line.split('{|}');
    var cparts = cline.split('{|}');
    s = Math.max(width - cparts[0].length - cparts[1].length, 0);
    s = Array(s + 1).join(' ');
    return parts[0] + s + parts[1];
  }

  return line;
};

Element.prototype._wrapContent = function(content, width) {
  var tags = this.parseTags
    , state = this.align
    , wrap = this.wrap
    , margin = 0
    , rtof = []
    , ftor = []
    , out = []
    , no = 0
    , line
    , align
    , cap
    , total
    , i
    , part
    , j
    , lines
    , rest;

  lines = content.split('\n');

  if (!content) {
    out.push(content);
    out.rtof = [0];
    out.ftor = [[0]];
    out.fake = lines;
    out.real = out;
    out.mwidth = 0;
    return out;
  }

  if (this.scrollbar) margin++;
  if (this.type === 'textarea') margin++;
  if (width > margin) width -= margin;

main:
  for (; no < lines.length; no++) {
    line = lines[no];
    align = state;

    ftor.push([]);

    // Handle alignment tags.
    if (tags) {
      if (cap = /^{(left|center|right)}/.exec(line)) {
        line = line.substring(cap[0].length);
        align = state = cap[1] !== 'left'
          ? cap[1]
          : null;
      }
      if (cap = /{\/(left|center|right)}$/.exec(line)) {
        line = line.slice(0, -cap[0].length);
        //state = null;
        state = this.align;
      }
    }

    // If the string is apparently too long, wrap it.
    while (line.length > width) {
      // Measure the real width of the string.
      for (i = 0, total = 0; i < line.length; i++) {
        while (line[i] === '\x1b') {
          while (line[i] && line[i++] !== 'm');
        }
        if (!line[i]) break;
        if (++total === width) {
          // If we're not wrapping the text, we have to finish up the rest of
          // the control sequences before cutting off the line.
          i++;
          if (!wrap) {
            rest = line.substring(i).match(/\x1b\[[^m]*m/g);
            rest = rest ? rest.join('') : '';
            out.push(this._align(line.substring(0, i) + rest, width, align));
            ftor[no].push(out.length - 1);
            rtof.push(no);
            continue main;
          }
          if (!this.screen.fullUnicode) {
            // Try to find a space to break on.
            if (i !== line.length) {
              j = i;
              while (j > i - 10 && j > 0 && line[--j] !== ' ');
              if (line[j] === ' ') i = j + 1;
            }
          } else {
            // Try to find a character to break on.
            if (i !== line.length) {
              // <XXX>
              // Compensate for surrogate length
              // counts on wrapping (experimental):
              // NOTE: Could optimize this by putting
              // it in the parent for loop.
              if (unicode.isSurrogate(line, i)) i--;
              for (var s = 0, n = 0; n < i; n++) {
                if (unicode.isSurrogate(line, n)) s++, n++;
              }
              i += s;
              // </XXX>
              j = i;
              // Break _past_ space.
              // Break _past_ double-width chars.
              // Break _past_ surrogate pairs.
              // Break _past_ combining chars.
              while (j > i - 10 && j > 0) {
                j--;
                if (line[j] === ' '
                    || line[j] === '\x03'
                    || (unicode.isSurrogate(line, j - 1) && line[j + 1] !== '\x03')
                    || unicode.isCombining(line, j)) {
                  break;
                }
              }
              if (line[j] === ' '
                  || line[j] === '\x03'
                  || (unicode.isSurrogate(line, j - 1) && line[j + 1] !== '\x03')
                  || unicode.isCombining(line, j)) {
                i = j + 1;
              }
            }
          }
          break;
        }
      }

      part = line.substring(0, i);
      line = line.substring(i);

      out.push(this._align(part, width, align));
      ftor[no].push(out.length - 1);
      rtof.push(no);

      // Make sure we didn't wrap the line to the very end, otherwise
      // we get a pointless empty line after a newline.
      if (line === '') continue main;

      // If only an escape code got cut off, at it to `part`.
      if (/^(?:\x1b[\[\d;]*m)+$/.test(line)) {
        out[out.length - 1] += line;
        continue main;
      }
    }

    out.push(this._align(line, width, align));
    ftor[no].push(out.length - 1);
    rtof.push(no);
  }

  out.rtof = rtof;
  out.ftor = ftor;
  out.fake = lines;
  out.real = out;

  out.mwidth = out.reduce(function(current, line) {
    line = line.replace(/\x1b\[[\d;]*m/g, '');
    return line.length > current
      ? line.length
      : current;
  }, 0);

  return out;
};

Element.prototype.__defineGetter__('visible', function() {
  var el = this;
  do {
    if (el.detached) return false;
    if (el.hidden) return false;
    // if (!el.lpos) return false;
    // if (el.position.width === 0 || el.position.height === 0) return false;
  } while (el = el.parent);
  return true;
});

Element.prototype.__defineGetter__('_detached', function() {
  var el = this;
  do {
    if (el.type === 'screen') return false;
    if (!el.parent) return true;
  } while (el = el.parent);
  return false;
});

Element.prototype.enableMouse = function() {
  this.screen._listenMouse(this);
};

Element.prototype.enableKeys = function() {
  this.screen._listenKeys(this);
};

Element.prototype.enableInput = function() {
  this.screen._listenMouse(this);
  this.screen._listenKeys(this);
};

Element.prototype.__defineGetter__('draggable', function() {
  return this._draggable === true;
});

Element.prototype.__defineSetter__('draggable', function(draggable) {
  return draggable ? this.enableDrag(draggable) : this.disableDrag();
});

Element.prototype.enableDrag = function(verify) {
  var self = this;

  if (this._draggable) return true;

  if (typeof verify !== 'function') {
    verify = function() { return true; };
  }

  this.enableMouse();

  this.on('mousedown', this._dragMD = function(data) {
    if (self.screen._dragging) return;
    if (!verify(data)) return;
    self.screen._dragging = self;
    self._drag = {
      x: data.x - self.aleft,
      y: data.y - self.atop
    };
    self.setFront();
  });

  this.onScreenEvent('mouse', this._dragM = function(data) {
    if (self.screen._dragging !== self) return;

    if (data.action !== 'mousedown' && data.action !== 'mousemove') {
      delete self.screen._dragging;
      delete self._drag;
      return;
    }

    // This can happen in edge cases where the user is
    // already dragging and element when it is detached.
    if (!self.parent) return;

    var ox = self._drag.x
      , oy = self._drag.y
      , px = self.parent.aleft
      , py = self.parent.atop
      , x = data.x - px - ox
      , y = data.y - py - oy;

    if (self.position.right != null) {
      if (self.position.left != null) {
        self.width = '100%-' + (self.parent.width - self.width);
      }
      self.position.right = null;
    }

    if (self.position.bottom != null) {
      if (self.position.top != null) {
        self.height = '100%-' + (self.parent.height - self.height);
      }
      self.position.bottom = null;
    }

    self.rleft = x;
    self.rtop = y;

    self.screen.render();
  });

  return this._draggable = true;
};

Element.prototype.disableDrag = function() {
  if (!this._draggable) return false;
  delete this.screen._dragging;
  delete this._drag;
  this.removeListener('mousedown', this._dragMD);
  this.removeScreenEvent('mouse', this._dragM);
  return this._draggable = false;
};

Element.prototype.key = function() {
  return this.screen.program.key.apply(this, arguments);
};

Element.prototype.onceKey = function() {
  return this.screen.program.onceKey.apply(this, arguments);
};

Element.prototype.unkey =
Element.prototype.removeKey = function() {
  return this.screen.program.unkey.apply(this, arguments);
};

Element.prototype.setIndex = function(index) {
  if (!this.parent) return;

  if (index < 0) {
    index = this.parent.children.length + index;
  }

  index = Math.max(index, 0);
  index = Math.min(index, this.parent.children.length - 1);

  var i = this.parent.children.indexOf(this);
  if (!~i) return;

  var item = this.parent.children.splice(i, 1)[0];
  this.parent.children.splice(index, 0, item);
};

Element.prototype.setFront = function() {
  return this.setIndex(-1);
};

Element.prototype.setBack = function() {
  return this.setIndex(0);
};

Element.prototype.clearPos = function(get, override) {
  if (this.detached) return;
  var lpos = this._getCoords(get);
  if (!lpos) return;
  this.screen.clearRegion(
    lpos.xi, lpos.xl,
    lpos.yi, lpos.yl,
    override);
};

Element.prototype.setLabel = function(options) {
  var self = this;
  var Box = require('./box');

  if (typeof options === 'string') {
    options = { text: options };
  }

  if (this._label) {
    this._label.setContent(options.text);
    if (options.side !== 'right') {
      this._label.rleft = 2 + (this.border ? -1 : 0);
      this._label.position.right = undefined;
      if (!this.screen.autoPadding) {
        this._label.rleft = 2;
      }
    } else {
      this._label.rright = 2 + (this.border ? -1 : 0);
      this._label.position.left = undefined;
      if (!this.screen.autoPadding) {
        this._label.rright = 2;
      }
    }
    return;
  }

  this._label = new Box({
    screen: this.screen,
    parent: this,
    content: options.text,
    top: -this.itop,
    tags: this.parseTags,
    shrink: true,
    style: this.style.label
  });

  if (options.side !== 'right') {
    this._label.rleft = 2 - this.ileft;
  } else {
    this._label.rright = 2 - this.iright;
  }

  this._label._isLabel = true;

  if (!this.screen.autoPadding) {
    if (options.side !== 'right') {
      this._label.rleft = 2;
    } else {
      this._label.rright = 2;
    }
    this._label.rtop = 0;
  }

  var reposition = function() {
    self._label.rtop = (self.childBase || 0) - self.itop;
    if (!self.screen.autoPadding) {
      self._label.rtop = (self.childBase || 0);
    }
    self.screen.render();
  };

  this.on('scroll', this._labelScroll = function() {
    reposition();
  });

  this.on('resize', this._labelResize = function() {
    nextTick(function() {
      reposition();
    });
  });
};

Element.prototype.removeLabel = function() {
  if (!this._label) return;
  this.removeListener('scroll', this._labelScroll);
  this.removeListener('resize', this._labelResize);
  this._label.detach();
  delete this._labelScroll;
  delete this._labelResize;
  delete this._label;
};

Element.prototype.setHover = function(options) {
  if (typeof options === 'string') {
    options = { text: options };
  }

  this._hoverOptions = options;
  this.enableMouse();
  this.screen._initHover();
};

Element.prototype.removeHover = function() {
  delete this._hoverOptions;
  if (!this.screen._hoverText || this.screen._hoverText.detached) return;
  this.screen._hoverText.detach();
  this.screen.render();
};

/**
 * Positioning
 */

// The below methods are a bit confusing: basically
// whenever Box.render is called `lpos` gets set on
// the element, an object containing the rendered
// coordinates. Since these don't update if the
// element is moved somehow, they're unreliable in
// that situation. However, if we can guarantee that
// lpos is good and up to date, it can be more
// accurate than the calculated positions below.
// In this case, if the element is being rendered,
// it's guaranteed that the parent will have been
// rendered first, in which case we can use the
// parant's lpos instead of recalculating it's
// position (since that might be wrong because
// it doesn't handle content shrinkage).

Element.prototype._getPos = function() {
  var pos = this.lpos;

  assert.ok(pos);

  if (pos.aleft != null) return pos;

  pos.aleft = pos.xi;
  pos.atop = pos.yi;
  pos.aright = this.screen.cols - pos.xl;
  pos.abottom = this.screen.rows - pos.yl;
  pos.width = pos.xl - pos.xi;
  pos.height = pos.yl - pos.yi;

  return pos;
};

/**
 * Position Getters
 */

Element.prototype._getWidth = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , width = this.position.width
    , left
    , expr;

  if (typeof width === 'string') {
    if (width === 'half') width = '50%';
    expr = width.split(/(?=\+|-)/);
    width = expr[0];
    width = +width.slice(0, -1) / 100;
    width = parent.width * width | 0;
    width += +(expr[1] || 0);
    return width;
  }

  // This is for if the element is being streched or shrunken.
  // Although the width for shrunken elements is calculated
  // in the render function, it may be calculated based on
  // the content width, and the content width is initially
  // decided by the width the element, so it needs to be
  // calculated here.
  if (width == null) {
    left = this.position.left || 0;
    if (typeof left === 'string') {
      if (left === 'center') left = '50%';
      expr = left.split(/(?=\+|-)/);
      left = expr[0];
      left = +left.slice(0, -1) / 100;
      left = parent.width * left | 0;
      left += +(expr[1] || 0);
    }
    width = parent.width - (this.position.right || 0) - left;
    if (this.screen.autoPadding) {
      if ((this.position.left != null || this.position.right == null)
          && this.position.left !== 'center') {
        width -= this.parent.ileft;
      }
      width -= this.parent.iright;
    }
  }

  return width;
};

Element.prototype.__defineGetter__('width', function() {
  return this._getWidth(false);
});

Element.prototype._getHeight = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , height = this.position.height
    , top
    , expr;

  if (typeof height === 'string') {
    if (height === 'half') height = '50%';
    expr = height.split(/(?=\+|-)/);
    height = expr[0];
    height = +height.slice(0, -1) / 100;
    height = parent.height * height | 0;
    height += +(expr[1] || 0);
    return height;
  }

  // This is for if the element is being streched or shrunken.
  // Although the width for shrunken elements is calculated
  // in the render function, it may be calculated based on
  // the content width, and the content width is initially
  // decided by the width the element, so it needs to be
  // calculated here.
  if (height == null) {
    top = this.position.top || 0;
    if (typeof top === 'string') {
      if (top === 'center') top = '50%';
      expr = top.split(/(?=\+|-)/);
      top = expr[0];
      top = +top.slice(0, -1) / 100;
      top = parent.height * top | 0;
      top += +(expr[1] || 0);
    }
    height = parent.height - (this.position.bottom || 0) - top;
    if (this.screen.autoPadding) {
      if ((this.position.top != null
          || this.position.bottom == null)
          && this.position.top !== 'center') {
        height -= this.parent.itop;
      }
      height -= this.parent.ibottom;
    }
  }

  return height;
};

Element.prototype.__defineGetter__('height', function() {
  return this._getHeight(false);
});

Element.prototype._getLeft = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , left = this.position.left || 0
    , expr;

  if (typeof left === 'string') {
    if (left === 'center') left = '50%';
    expr = left.split(/(?=\+|-)/);
    left = expr[0];
    left = +left.slice(0, -1) / 100;
    left = parent.width * left | 0;
    left += +(expr[1] || 0);
    if (this.position.left === 'center') {
      left -= this._getWidth(get) / 2 | 0;
    }
  }

  if (this.position.left == null && this.position.right != null) {
    return this.screen.cols - this._getWidth(get) - this._getRight(get);
  }

  if (this.screen.autoPadding) {
    if ((this.position.left != null
        || this.position.right == null)
        && this.position.left !== 'center') {
      left += this.parent.ileft;
    }
  }

  return (parent.aleft || 0) + left;
};

Element.prototype.__defineGetter__('aleft', function() {
  return this._getLeft(false);
});

Element.prototype._getRight = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , right;

  if (this.position.right == null && this.position.left != null) {
    right = this.screen.cols - (this._getLeft(get) + this._getWidth(get));
    if (this.screen.autoPadding) {
      right += this.parent.iright;
    }
    return right;
  }

  right = (parent.aright || 0) + (this.position.right || 0);

  if (this.screen.autoPadding) {
    right += this.parent.iright;
  }

  return right;
};

Element.prototype.__defineGetter__('aright', function() {
  return this._getRight(false);
});

Element.prototype._getTop = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , top = this.position.top || 0
    , expr;

  if (typeof top === 'string') {
    if (top === 'center') top = '50%';
    expr = top.split(/(?=\+|-)/);
    top = expr[0];
    top = +top.slice(0, -1) / 100;
    top = parent.height * top | 0;
    top += +(expr[1] || 0);
    if (this.position.top === 'center') {
      top -= this._getHeight(get) / 2 | 0;
    }
  }

  if (this.position.top == null && this.position.bottom != null) {
    return this.screen.rows - this._getHeight(get) - this._getBottom(get);
  }

  if (this.screen.autoPadding) {
    if ((this.position.top != null
        || this.position.bottom == null)
        && this.position.top !== 'center') {
      top += this.parent.itop;
    }
  }

  return (parent.atop || 0) + top;
};

Element.prototype.__defineGetter__('atop', function() {
  return this._getTop(false);
});

Element.prototype._getBottom = function(get) {
  var parent = get ? this.parent._getPos() : this.parent
    , bottom;

  if (this.position.bottom == null && this.position.top != null) {
    bottom = this.screen.rows - (this._getTop(get) + this._getHeight(get));
    if (this.screen.autoPadding) {
      bottom += this.parent.ibottom;
    }
    return bottom;
  }

  bottom = (parent.abottom || 0) + (this.position.bottom || 0);

  if (this.screen.autoPadding) {
    bottom += this.parent.ibottom;
  }

  return bottom;
};

Element.prototype.__defineGetter__('abottom', function() {
  return this._getBottom(false);
});

Element.prototype.__defineGetter__('rleft', function() {
  return this.aleft - this.parent.aleft;
});

Element.prototype.__defineGetter__('rright', function() {
  return this.aright - this.parent.aright;
});

Element.prototype.__defineGetter__('rtop', function() {
  return this.atop - this.parent.atop;
});

Element.prototype.__defineGetter__('rbottom', function() {
  return this.abottom - this.parent.abottom;
});

/**
 * Position Setters
 */

// NOTE:
// For aright, abottom, right, and bottom:
// If position.bottom is null, we could simply set top instead.
// But it wouldn't replicate bottom behavior appropriately if
// the parent was resized, etc.
Element.prototype.__defineSetter__('width', function(val) {
  if (this.position.width === val) return;
  if (/^\d+$/.test(val)) val = +val;
  this.emit('resize');
  this.clearPos();
  return this.position.width = val;
});

Element.prototype.__defineSetter__('height', function(val) {
  if (this.position.height === val) return;
  if (/^\d+$/.test(val)) val = +val;
  this.emit('resize');
  this.clearPos();
  return this.position.height = val;
});

Element.prototype.__defineSetter__('aleft', function(val) {
  var expr;
  if (typeof val === 'string') {
    if (val === 'center') {
      val = this.screen.width / 2 | 0;
      val -= this.width / 2 | 0;
    } else {
      expr = val.split(/(?=\+|-)/);
      val = expr[0];
      val = +val.slice(0, -1) / 100;
      val = this.screen.width * val | 0;
      val += +(expr[1] || 0);
    }
  }
  val -= this.parent.aleft;
  if (this.position.left === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.left = val;
});

Element.prototype.__defineSetter__('aright', function(val) {
  val -= this.parent.aright;
  if (this.position.right === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.right = val;
});

Element.prototype.__defineSetter__('atop', function(val) {
  var expr;
  if (typeof val === 'string') {
    if (val === 'center') {
      val = this.screen.height / 2 | 0;
      val -= this.height / 2 | 0;
    } else {
      expr = val.split(/(?=\+|-)/);
      val = expr[0];
      val = +val.slice(0, -1) / 100;
      val = this.screen.height * val | 0;
      val += +(expr[1] || 0);
    }
  }
  val -= this.parent.atop;
  if (this.position.top === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.top = val;
});

Element.prototype.__defineSetter__('abottom', function(val) {
  val -= this.parent.abottom;
  if (this.position.bottom === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.bottom = val;
});

Element.prototype.__defineSetter__('rleft', function(val) {
  if (this.position.left === val) return;
  if (/^\d+$/.test(val)) val = +val;
  this.emit('move');
  this.clearPos();
  return this.position.left = val;
});

Element.prototype.__defineSetter__('rright', function(val) {
  if (this.position.right === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.right = val;
});

Element.prototype.__defineSetter__('rtop', function(val) {
  if (this.position.top === val) return;
  if (/^\d+$/.test(val)) val = +val;
  this.emit('move');
  this.clearPos();
  return this.position.top = val;
});

Element.prototype.__defineSetter__('rbottom', function(val) {
  if (this.position.bottom === val) return;
  this.emit('move');
  this.clearPos();
  return this.position.bottom = val;
});

Element.prototype.__defineGetter__('ileft', function() {
  return (this.border ? 1 : 0) + this.padding.left;
  // return (this.border && this.border.left ? 1 : 0) + this.padding.left;
});

Element.prototype.__defineGetter__('itop', function() {
  return (this.border ? 1 : 0) + this.padding.top;
  // return (this.border && this.border.top ? 1 : 0) + this.padding.top;
});

Element.prototype.__defineGetter__('iright', function() {
  return (this.border ? 1 : 0) + this.padding.right;
  // return (this.border && this.border.right ? 1 : 0) + this.padding.right;
});

Element.prototype.__defineGetter__('ibottom', function() {
  return (this.border ? 1 : 0) + this.padding.bottom;
  // return (this.border && this.border.bottom ? 1 : 0) + this.padding.bottom;
});

Element.prototype.__defineGetter__('iwidth', function() {
  // return (this.border
  //   ? ((this.border.left ? 1 : 0) + (this.border.right ? 1 : 0)) : 0)
  //   + this.padding.left + this.padding.right;
  return (this.border ? 2 : 0) + this.padding.left + this.padding.right;
});

Element.prototype.__defineGetter__('iheight', function() {
  // return (this.border
  //   ? ((this.border.top ? 1 : 0) + (this.border.bottom ? 1 : 0)) : 0)
  //   + this.padding.top + this.padding.bottom;
  return (this.border ? 2 : 0) + this.padding.top + this.padding.bottom;
});

Element.prototype.__defineGetter__('tpadding', function() {
  return this.padding.left + this.padding.top
    + this.padding.right + this.padding.bottom;
});

/**
 * Relative coordinates as default properties
 */

Element.prototype.__defineGetter__('left', function() {
  return this.rleft;
});

Element.prototype.__defineGetter__('right', function() {
  return this.rright;
});

Element.prototype.__defineGetter__('top', function() {
  return this.rtop;
});

Element.prototype.__defineGetter__('bottom', function() {
  return this.rbottom;
});

Element.prototype.__defineSetter__('left', function(val) {
  return this.rleft = val;
});

Element.prototype.__defineSetter__('right', function(val) {
  return this.rright = val;
});

Element.prototype.__defineSetter__('top', function(val) {
  return this.rtop = val;
});

Element.prototype.__defineSetter__('bottom', function(val) {
  return this.rbottom = val;
});

/**
 * Rendering - here be dragons
 */

Element.prototype._getShrinkBox = function(xi, xl, yi, yl, get) {
  if (!this.children.length) {
    return { xi: xi, xl: xi + 1, yi: yi, yl: yi + 1 };
  }

  var i, el, ret, mxi = xi, mxl = xi + 1, myi = yi, myl = yi + 1;

  // This is a chicken and egg problem. We need to determine how the children
  // will render in order to determine how this element renders, but it in
  // order to figure out how the children will render, they need to know
  // exactly how their parent renders, so, we can give them what we have so
  // far.
  var _lpos;
  if (get) {
    _lpos = this.lpos;
    this.lpos = { xi: xi, xl: xl, yi: yi, yl: yl };
    //this.shrink = false;
  }

  for (i = 0; i < this.children.length; i++) {
    el = this.children[i];

    ret = el._getCoords(get);

    // Or just (seemed to work, but probably not good):
    // ret = el.lpos || this.lpos;

    if (!ret) continue;

    // Since the parent element is shrunk, and the child elements think it's
    // going to take up as much space as possible, an element anchored to the
    // right or bottom will inadvertantly make the parent's shrunken size as
    // large as possible. So, we can just use the height and/or width the of
    // element.
    // if (get) {
    if (el.position.left == null && el.position.right != null) {
      ret.xl = xi + (ret.xl - ret.xi);
      ret.xi = xi;
      if (this.screen.autoPadding) {
        // Maybe just do this no matter what.
        ret.xl += this.ileft;
        ret.xi += this.ileft;
      }
    }
    if (el.position.top == null && el.position.bottom != null) {
      ret.yl = yi + (ret.yl - ret.yi);
      ret.yi = yi;
      if (this.screen.autoPadding) {
        // Maybe just do this no matter what.
        ret.yl += this.itop;
        ret.yi += this.itop;
      }
    }

    if (ret.xi < mxi) mxi = ret.xi;
    if (ret.xl > mxl) mxl = ret.xl;
    if (ret.yi < myi) myi = ret.yi;
    if (ret.yl > myl) myl = ret.yl;
  }

  if (get) {
    this.lpos = _lpos;
    //this.shrink = true;
  }

  if (this.position.width == null
      && (this.position.left == null
      || this.position.right == null)) {
    if (this.position.left == null && this.position.right != null) {
      xi = xl - (mxl - mxi);
      if (!this.screen.autoPadding) {
        xi -= this.padding.left + this.padding.right;
      } else {
        xi -= this.ileft;
      }
    } else {
      xl = mxl;
      if (!this.screen.autoPadding) {
        xl += this.padding.left + this.padding.right;
        // XXX Temporary workaround until we decide to make autoPadding default.
        // See widget-listtable.js for an example of why this is necessary.
        // XXX Maybe just to this for all this being that this would affect
        // width shrunken normal shrunken lists as well.
        // if (this._isList) {
        if (this.type === 'list-table') {
          xl -= this.padding.left + this.padding.right;
          xl += this.iright;
        }
      } else {
        //xl += this.padding.right;
        xl += this.iright;
      }
    }
  }

  if (this.position.height == null
      && (this.position.top == null
      || this.position.bottom == null)
      && (!this.scrollable || this._isList)) {
    // NOTE: Lists get special treatment if they are shrunken - assume they
    // want all list items showing. This is one case we can calculate the
    // height based on items/boxes.
    if (this._isList) {
      myi = 0 - this.itop;
      myl = this.items.length + this.ibottom;
    }
    if (this.position.top == null && this.position.bottom != null) {
      yi = yl - (myl - myi);
      if (!this.screen.autoPadding) {
        yi -= this.padding.top + this.padding.bottom;
      } else {
        yi -= this.itop;
      }
    } else {
      yl = myl;
      if (!this.screen.autoPadding) {
        yl += this.padding.top + this.padding.bottom;
      } else {
        yl += this.ibottom;
      }
    }
  }

  return { xi: xi, xl: xl, yi: yi, yl: yl };
};

Element.prototype._getShrinkContent = function(xi, xl, yi, yl) {
  var h = this._clines.length
    , w = this._clines.mwidth || 1;

  if (this.position.width == null
      && (this.position.left == null
      || this.position.right == null)) {
    if (this.position.left == null && this.position.right != null) {
      xi = xl - w - this.iwidth;
    } else {
      xl = xi + w + this.iwidth;
    }
  }

  if (this.position.height == null
      && (this.position.top == null
      || this.position.bottom == null)
      && (!this.scrollable || this._isList)) {
    if (this.position.top == null && this.position.bottom != null) {
      yi = yl - h - this.iheight;
    } else {
      yl = yi + h + this.iheight;
    }
  }

  return { xi: xi, xl: xl, yi: yi, yl: yl };
};

Element.prototype._getShrink = function(xi, xl, yi, yl, get) {
  var shrinkBox = this._getShrinkBox(xi, xl, yi, yl, get)
    , shrinkContent = this._getShrinkContent(xi, xl, yi, yl, get)
    , xll = xl
    , yll = yl;

  // Figure out which one is bigger and use it.
  if (shrinkBox.xl - shrinkBox.xi > shrinkContent.xl - shrinkContent.xi) {
    xi = shrinkBox.xi;
    xl = shrinkBox.xl;
  } else {
    xi = shrinkContent.xi;
    xl = shrinkContent.xl;
  }

  if (shrinkBox.yl - shrinkBox.yi > shrinkContent.yl - shrinkContent.yi) {
    yi = shrinkBox.yi;
    yl = shrinkBox.yl;
  } else {
    yi = shrinkContent.yi;
    yl = shrinkContent.yl;
  }

  // Recenter shrunken elements.
  if (xl < xll && this.position.left === 'center') {
    xll = (xll - xl) / 2 | 0;
    xi += xll;
    xl += xll;
  }

  if (yl < yll && this.position.top === 'center') {
    yll = (yll - yl) / 2 | 0;
    yi += yll;
    yl += yll;
  }

  return { xi: xi, xl: xl, yi: yi, yl: yl };
};

Element.prototype._getCoords = function(get, noscroll) {
  if (this.hidden) return;

  // if (this.parent._rendering) {
  //   get = true;
  // }

  var xi = this._getLeft(get)
    , xl = xi + this._getWidth(get)
    , yi = this._getTop(get)
    , yl = yi + this._getHeight(get)
    , base = this.childBase || 0
    , el = this
    , fixed = this.fixed
    , coords
    , v
    , noleft
    , noright
    , notop
    , nobot
    , ppos
    , b;

  // Attempt to shrink the element base on the
  // size of the content and child elements.
  if (this.shrink) {
    coords = this._getShrink(xi, xl, yi, yl, get);
    xi = coords.xi, xl = coords.xl;
    yi = coords.yi, yl = coords.yl;
  }

  // Find a scrollable ancestor if we have one.
  while (el = el.parent) {
    if (el.scrollable) {
      if (fixed) {
        fixed = false;
        continue;
      }
      break;
    }
  }

  // Check to make sure we're visible and
  // inside of the visible scroll area.
  // NOTE: Lists have a property where only
  // the list items are obfuscated.

  // Old way of doing things, this would not render right if a shrunken element
  // with lots of boxes in it was within a scrollable element.
  // See: $ node test/widget-shrink-fail.js
  // var thisparent = this.parent;

  var thisparent = el;
  if (el && !noscroll) {
    ppos = thisparent.lpos;

    // The shrink option can cause a stack overflow
    // by calling _getCoords on the child again.
    // if (!get && !thisparent.shrink) {
    //   ppos = thisparent._getCoords();
    // }

    if (!ppos) return;

    // TODO: Figure out how to fix base (and cbase to only
    // take into account the *parent's* padding.

    yi -= ppos.base;
    yl -= ppos.base;

    b = thisparent.border ? 1 : 0;

    // XXX
    // Fixes non-`fixed` labels to work with scrolling (they're ON the border):
    // if (this.position.left < 0
    //     || this.position.right < 0
    //     || this.position.top < 0
    //     || this.position.bottom < 0) {
    if (this._isLabel) {
      b = 0;
    }

    if (yi < ppos.yi + b) {
      if (yl - 1 < ppos.yi + b) {
        // Is above.
        return;
      } else {
        // Is partially covered above.
        notop = true;
        v = ppos.yi - yi;
        if (this.border) v--;
        if (thisparent.border) v++;
        base += v;
        yi += v;
      }
    } else if (yl > ppos.yl - b) {
      if (yi > ppos.yl - 1 - b) {
        // Is below.
        return;
      } else {
        // Is partially covered below.
        nobot = true;
        v = yl - ppos.yl;
        if (this.border) v--;
        if (thisparent.border) v++;
        yl -= v;
      }
    }

    // Shouldn't be necessary.
    // assert.ok(yi < yl);
    if (yi >= yl) return;

    // Could allow overlapping stuff in scrolling elements
    // if we cleared the pending buffer before every draw.
    if (xi < el.lpos.xi) {
      xi = el.lpos.xi;
      noleft = true;
      if (this.border) xi--;
      if (thisparent.border) xi++;
    }
    if (xl > el.lpos.xl) {
      xl = el.lpos.xl;
      noright = true;
      if (this.border) xl++;
      if (thisparent.border) xl--;
    }
    //if (xi > xl) return;
    if (xi >= xl) return;
  }

  if (this.noOverflow && this.parent.lpos) {
    if (xi < this.parent.lpos.xi + this.parent.ileft) {
      xi = this.parent.lpos.xi + this.parent.ileft;
    }
    if (xl > this.parent.lpos.xl - this.parent.iright) {
      xl = this.parent.lpos.xl - this.parent.iright;
    }
    if (yi < this.parent.lpos.yi + this.parent.itop) {
      yi = this.parent.lpos.yi + this.parent.itop;
    }
    if (yl > this.parent.lpos.yl - this.parent.ibottom) {
      yl = this.parent.lpos.yl - this.parent.ibottom;
    }
  }

  // if (this.parent.lpos) {
  //   this.parent.lpos._scrollBottom = Math.max(
  //     this.parent.lpos._scrollBottom, yl);
  // }

  return {
    xi: xi,
    xl: xl,
    yi: yi,
    yl: yl,
    base: base,
    noleft: noleft,
    noright: noright,
    notop: notop,
    nobot: nobot,
    renders: this.screen.renders
  };
};

Element.prototype.render = function() {
  this._emit('prerender');

  this.parseContent();

  var coords = this._getCoords(true);
  if (!coords) {
    delete this.lpos;
    return;
  }

  if (coords.xl - coords.xi <= 0) {
    coords.xl = Math.max(coords.xl, coords.xi);
    return;
  }

  if (coords.yl - coords.yi <= 0) {
    coords.yl = Math.max(coords.yl, coords.yi);
    return;
  }

  var lines = this.screen.lines
    , xi = coords.xi
    , xl = coords.xl
    , yi = coords.yi
    , yl = coords.yl
    , x
    , y
    , cell
    , attr
    , ch
    , content = this._pcontent
    , ci = this._clines.ci[coords.base]
    , battr
    , dattr
    , c
    , visible
    , i
    , bch = this.ch;

  // Clip content if it's off the edge of the screen
  // if (xi + this.ileft < 0 || yi + this.itop < 0) {
  //   var clines = this._clines.slice();
  //   if (xi + this.ileft < 0) {
  //     for (var i = 0; i < clines.length; i++) {
  //       var t = 0;
  //       var csi = '';
  //       var csis = '';
  //       for (var j = 0; j < clines[i].length; j++) {
  //         while (clines[i][j] === '\x1b') {
  //           csi = '\x1b';
  //           while (clines[i][j++] !== 'm') csi += clines[i][j];
  //           csis += csi;
  //         }
  //         if (++t === -(xi + this.ileft) + 1) break;
  //       }
  //       clines[i] = csis + clines[i].substring(j);
  //     }
  //   }
  //   if (yi + this.itop < 0) {
  //     clines = clines.slice(-(yi + this.itop));
  //   }
  //   content = clines.join('\n');
  // }

  if (coords.base >= this._clines.ci.length) {
    ci = this._pcontent.length;
  }

  this.lpos = coords;

  if (this.border && this.border.type === 'line') {
    this.screen._borderStops[coords.yi] = true;
    this.screen._borderStops[coords.yl - 1] = true;
    // if (!this.screen._borderStops[coords.yi]) {
    //   this.screen._borderStops[coords.yi] = { xi: coords.xi, xl: coords.xl };
    // } else {
    //   if (this.screen._borderStops[coords.yi].xi > coords.xi) {
    //     this.screen._borderStops[coords.yi].xi = coords.xi;
    //   }
    //   if (this.screen._borderStops[coords.yi].xl < coords.xl) {
    //     this.screen._borderStops[coords.yi].xl = coords.xl;
    //   }
    // }
    // this.screen._borderStops[coords.yl - 1] = this.screen._borderStops[coords.yi];
  }

  dattr = this.sattr(this.style);
  attr = dattr;

  // If we're in a scrollable text box, check to
  // see which attributes this line starts with.
  if (ci > 0) {
    attr = this._clines.attr[Math.min(coords.base, this._clines.length - 1)];
  }

  if (this.border) xi++, xl--, yi++, yl--;

  // If we have padding/valign, that means the
  // content-drawing loop will skip a few cells/lines.
  // To deal with this, we can just fill the whole thing
  // ahead of time. This could be optimized.
  if (this.tpadding || (this.valign && this.valign !== 'top')) {
    if (this.style.transparent) {
      for (y = Math.max(yi, 0); y < yl; y++) {
        if (!lines[y]) break;
        for (x = Math.max(xi, 0); x < xl; x++) {
          if (!lines[y][x]) break;
          lines[y][x][0] = colors.blend(attr, lines[y][x][0]);
          // lines[y][x][1] = bch;
          lines[y].dirty = true;
        }
      }
    } else {
      this.screen.fillRegion(dattr, bch, xi, xl, yi, yl);
    }
  }

  if (this.tpadding) {
    xi += this.padding.left, xl -= this.padding.right;
    yi += this.padding.top, yl -= this.padding.bottom;
  }

  // Determine where to place the text if it's vertically aligned.
  if (this.valign === 'middle' || this.valign === 'bottom') {
    visible = yl - yi;
    if (this._clines.length < visible) {
      if (this.valign === 'middle') {
        visible = visible / 2 | 0;
        visible -= this._clines.length / 2 | 0;
      } else if (this.valign === 'bottom') {
        visible -= this._clines.length;
      }
      ci -= visible * (xl - xi);
    }
  }

  // Draw the content and background.
  for (y = yi; y < yl; y++) {
    if (!lines[y]) {
      if (y >= this.screen.height || yl < this.ibottom) {
        break;
      } else {
        continue;
      }
    }
    for (x = xi; x < xl; x++) {
      cell = lines[y][x];
      if (!cell) {
        if (x >= this.screen.width || xl < this.iright) {
          break;
        } else {
          continue;
        }
      }

      ch = content[ci++] || bch;

      // if (!content[ci] && !coords._contentEnd) {
      //   coords._contentEnd = { x: x - xi, y: y - yi };
      // }

      // Handle escape codes.
      while (ch === '\x1b') {
        if (c = /^\x1b\[[\d;]*m/.exec(content.substring(ci - 1))) {
          ci += c[0].length - 1;
          attr = this.screen.attrCode(c[0], attr, dattr);
          // Ignore foreground changes for selected items.
          if (this.parent._isList && this.parent.interactive
              && this.parent.items[this.parent.selected] === this
              && this.parent.options.invertSelected !== false) {
            attr = (attr & ~(0x1ff << 9)) | (dattr & (0x1ff << 9));
          }
          ch = content[ci] || bch;
          ci++;
        } else {
          break;
        }
      }

      // Handle newlines.
      if (ch === '\t') ch = bch;
      if (ch === '\n') {
        // If we're on the first cell and we find a newline and the last cell
        // of the last line was not a newline, let's just treat this like the
        // newline was already "counted".
        if (x === xi && y !== yi && content[ci - 2] !== '\n') {
          x--;
          continue;
        }
        // We could use fillRegion here, name the
        // outer loop, and continue to it instead.
        ch = bch;
        for (; x < xl; x++) {
          cell = lines[y][x];
          if (!cell) break;
          if (this.style.transparent) {
            lines[y][x][0] = colors.blend(attr, lines[y][x][0]);
            if (content[ci]) lines[y][x][1] = ch;
            lines[y].dirty = true;
          } else {
            if (attr !== cell[0] || ch !== cell[1]) {
              lines[y][x][0] = attr;
              lines[y][x][1] = ch;
              lines[y].dirty = true;
            }
          }
        }
        continue;
      }

      if (this.screen.fullUnicode && content[ci - 1]) {
        var point = unicode.codePointAt(content, ci - 1);
        // Handle combining chars:
        // Make sure they get in the same cell and are counted as 0.
        if (unicode.combining[point]) {
          if (point > 0x00ffff) {
            ch = content[ci - 1] + content[ci];
            ci++;
          }
          if (x - 1 >= xi) {
            lines[y][x - 1][1] += ch;
          } else if (y - 1 >= yi) {
            lines[y - 1][xl - 1][1] += ch;
          }
          x--;
          continue;
        }
        // Handle surrogate pairs:
        // Make sure we put surrogate pair chars in one cell.
        if (point > 0x00ffff) {
          ch = content[ci - 1] + content[ci];
          ci++;
        }
      }

      if (this._noFill) continue;

      if (this.style.transparent) {
        lines[y][x][0] = colors.blend(attr, lines[y][x][0]);
        if (content[ci]) lines[y][x][1] = ch;
        lines[y].dirty = true;
      } else {
        if (attr !== cell[0] || ch !== cell[1]) {
          lines[y][x][0] = attr;
          lines[y][x][1] = ch;
          lines[y].dirty = true;
        }
      }
    }
  }

  // Draw the scrollbar.
  // Could possibly draw this after all child elements.
  if (this.scrollbar) {
    // XXX
    // i = this.getScrollHeight();
    i = Math.max(this._clines.length, this._scrollBottom());
  }
  if (coords.notop || coords.nobot) i = -Infinity;
  if (this.scrollbar && (yl - yi) < i) {
    x = xl - 1;
    if (this.scrollbar.ignoreBorder && this.border) x++;
    if (this.alwaysScroll) {
      y = this.childBase / (i - (yl - yi));
    } else {
      y = (this.childBase + this.childOffset) / (i - 1);
    }
    y = yi + ((yl - yi) * y | 0);
    if (y >= yl) y = yl - 1;
    cell = lines[y] && lines[y][x];
    if (cell) {
      if (this.track) {
        ch = this.track.ch || ' ';
        attr = this.sattr(this.style.track,
          this.style.track.fg || this.style.fg,
          this.style.track.bg || this.style.bg);
        this.screen.fillRegion(attr, ch, x, x + 1, yi, yl);
      }
      ch = this.scrollbar.ch || ' ';
      attr = this.sattr(this.style.scrollbar,
        this.style.scrollbar.fg || this.style.fg,
        this.style.scrollbar.bg || this.style.bg);
      if (attr !== cell[0] || ch !== cell[1]) {
        lines[y][x][0] = attr;
        lines[y][x][1] = ch;
        lines[y].dirty = true;
      }
    }
  }

  if (this.border) xi--, xl++, yi--, yl++;

  if (this.tpadding) {
    xi -= this.padding.left, xl += this.padding.right;
    yi -= this.padding.top, yl += this.padding.bottom;
  }

  // Draw the border.
  if (this.border) {
    battr = this.sattr(this.style.border);
    y = yi;
    if (coords.notop) y = -1;
    for (x = xi; x < xl; x++) {
      if (!lines[y]) break;
      if (coords.noleft && x === xi) continue;
      if (coords.noright && x === xl - 1) continue;
      cell = lines[y][x];
      if (!cell) continue;
      if (this.border.type === 'line') {
        if (x === xi) {
          ch = '\u250c'; // '┌'
          if (!this.border.left) {
            if (this.border.top) {
              ch = '\u2500'; // '─'
            } else {
              continue;
            }
          } else {
            if (!this.border.top) {
              ch = '\u2502'; // '│'
            }
          }
        } else if (x === xl - 1) {
          ch = '\u2510'; // '┐'
          if (!this.border.right) {
            if (this.border.top) {
              ch = '\u2500'; // '─'
            } else {
              continue;
            }
          } else {
            if (!this.border.top) {
              ch = '\u2502'; // '│'
            }
          }
        } else {
          ch = '\u2500'; // '─'
        }
      } else if (this.border.type === 'bg') {
        ch = this.border.ch;
      }
      if (!this.border.top && x !== xi && x !== xl - 1) {
        ch = ' ';
        if (dattr !== cell[0] || ch !== cell[1]) {
          lines[y][x][0] = dattr;
          lines[y][x][1] = ch;
          lines[y].dirty = true;
          continue;
        }
      }
      if (battr !== cell[0] || ch !== cell[1]) {
        lines[y][x][0] = battr;
        lines[y][x][1] = ch;
        lines[y].dirty = true;
      }
    }
    y = yi + 1;
    for (; y < yl - 1; y++) {
      if (!lines[y]) continue;
      cell = lines[y][xi];
      if (cell) {
        if (this.border.left) {
          if (this.border.type === 'line') {
            ch = '\u2502'; // '│'
          } else if (this.border.type === 'bg') {
            ch = this.border.ch;
          }
          if (!coords.noleft)
          if (battr !== cell[0] || ch !== cell[1]) {
            lines[y][xi][0] = battr;
            lines[y][xi][1] = ch;
            lines[y].dirty = true;
          }
        } else {
          ch = ' ';
          if (dattr !== cell[0] || ch !== cell[1]) {
            lines[y][xi][0] = dattr;
            lines[y][xi][1] = ch;
            lines[y].dirty = true;
          }
        }
      }
      cell = lines[y][xl - 1];
      if (cell) {
        if (this.border.right) {
          if (this.border.type === 'line') {
            ch = '\u2502'; // '│'
          } else if (this.border.type === 'bg') {
            ch = this.border.ch;
          }
          if (!coords.noright)
          if (battr !== cell[0] || ch !== cell[1]) {
            lines[y][xl - 1][0] = battr;
            lines[y][xl - 1][1] = ch;
            lines[y].dirty = true;
          }
        } else {
          ch = ' ';
          if (dattr !== cell[0] || ch !== cell[1]) {
            lines[y][xl - 1][0] = dattr;
            lines[y][xl - 1][1] = ch;
            lines[y].dirty = true;
          }
        }
      }
    }
    y = yl - 1;
    if (coords.nobot) y = -1;
    for (x = xi; x < xl; x++) {
      if (!lines[y]) break;
      if (coords.noleft && x === xi) continue;
      if (coords.noright && x === xl - 1) continue;
      cell = lines[y][x];
      if (!cell) continue;
      if (this.border.type === 'line') {
        if (x === xi) {
          ch = '\u2514'; // '└'
          if (!this.border.left) {
            if (this.border.bottom) {
              ch = '\u2500'; // '─'
            } else {
              continue;
            }
          } else {
            if (!this.border.bottom) {
              ch = '\u2502'; // '│'
            }
          }
        } else if (x === xl - 1) {
          ch = '\u2518'; // '┘'
          if (!this.border.right) {
            if (this.border.bottom) {
              ch = '\u2500'; // '─'
            } else {
              continue;
            }
          } else {
            if (!this.border.bottom) {
              ch = '\u2502'; // '│'
            }
          }
        } else {
          ch = '\u2500'; // '─'
        }
      } else if (this.border.type === 'bg') {
        ch = this.border.ch;
      }
      if (!this.border.bottom && x !== xi && x !== xl - 1) {
        ch = ' ';
        if (dattr !== cell[0] || ch !== cell[1]) {
          lines[y][x][0] = dattr;
          lines[y][x][1] = ch;
          lines[y].dirty = true;
        }
        continue;
      }
      if (battr !== cell[0] || ch !== cell[1]) {
        lines[y][x][0] = battr;
        lines[y][x][1] = ch;
        lines[y].dirty = true;
      }
    }
  }

  if (this.shadow) {
    // right
    y = Math.max(yi + 1, 0);
    for (; y < yl + 1; y++) {
      if (!lines[y]) break;
      x = xl;
      for (; x < xl + 2; x++) {
        if (!lines[y][x]) break;
        // lines[y][x][0] = colors.blend(this.dattr, lines[y][x][0]);
        lines[y][x][0] = colors.blend(lines[y][x][0]);
        lines[y].dirty = true;
      }
    }
    // bottom
    y = yl;
    for (; y < yl + 1; y++) {
      if (!lines[y]) break;
      for (x = Math.max(xi + 1, 0); x < xl; x++) {
        if (!lines[y][x]) break;
        // lines[y][x][0] = colors.blend(this.dattr, lines[y][x][0]);
        lines[y][x][0] = colors.blend(lines[y][x][0]);
        lines[y].dirty = true;
      }
    }
  }

  this.children.forEach(function(el) {
    if (el.screen._ci !== -1) {
      el.index = el.screen._ci++;
    }
    // if (el.screen._rendering) {
    //   el._rendering = true;
    // }
    el.render();
    // if (el.screen._rendering) {
    //   el._rendering = false;
    // }
  });

  this._emit('render', [coords]);

  return coords;
};

Element.prototype._render = Element.prototype.render;

/**
 * Content Methods
 */

Element.prototype.insertLine = function(i, line) {
  if (typeof line === 'string') line = line.split('\n');

  if (i !== i || i == null) {
    i = this._clines.ftor.length;
  }

  i = Math.max(i, 0);

  while (this._clines.fake.length < i) {
    this._clines.fake.push('');
    this._clines.ftor.push([this._clines.push('') - 1]);
    this._clines.rtof(this._clines.fake.length - 1);
  }

  // NOTE: Could possibly compare the first and last ftor line numbers to see
  // if they're the same, or if they fit in the visible region entirely.
  var start = this._clines.length
    , diff
    , real;

  if (i >= this._clines.ftor.length) {
    real = this._clines.ftor[this._clines.ftor.length - 1];
    real = real[real.length - 1] + 1;
  } else {
    real = this._clines.ftor[i][0];
  }

  for (var j = 0; j < line.length; j++) {
    this._clines.fake.splice(i + j, 0, line[j]);
  }

  this.setContent(this._clines.fake.join('\n'), true);

  diff = this._clines.length - start;

  if (diff > 0) {
    var pos = this._getCoords();
    if (!pos) return;

    var height = pos.yl - pos.yi - this.iheight
      , base = this.childBase || 0
      , visible = real >= base && real - base < height;

    if (pos && visible && this.screen.cleanSides(this)) {
      this.screen.insertLine(diff,
        pos.yi + this.itop + real - base,
        pos.yi,
        pos.yl - this.ibottom - 1);
    }
  }
};

Element.prototype.deleteLine = function(i, n) {
  n = n || 1;

  if (i !== i || i == null) {
    i = this._clines.ftor.length - 1;
  }

  i = Math.max(i, 0);
  i = Math.min(i, this._clines.ftor.length - 1);

  // NOTE: Could possibly compare the first and last ftor line numbers to see
  // if they're the same, or if they fit in the visible region entirely.
  var start = this._clines.length
    , diff
    , real = this._clines.ftor[i][0];

  while (n--) {
    this._clines.fake.splice(i, 1);
  }

  this.setContent(this._clines.fake.join('\n'), true);

  diff = start - this._clines.length;

  // XXX clearPos() without diff statement?
  var height = 0;

  if (diff > 0) {
    var pos = this._getCoords();
    if (!pos) return;

    height = pos.yl - pos.yi - this.iheight;

    var base = this.childBase || 0
      , visible = real >= base && real - base < height;

    if (pos && visible && this.screen.cleanSides(this)) {
      this.screen.deleteLine(diff,
        pos.yi + this.itop + real - base,
        pos.yi,
        pos.yl - this.ibottom - 1);
    }
  }

  if (this._clines.length < height) {
    this.clearPos();
  }
};

Element.prototype.insertTop = function(line) {
  var fake = this._clines.rtof[this.childBase || 0];
  return this.insertLine(fake, line);
};

Element.prototype.insertBottom = function(line) {
  var h = (this.childBase || 0) + this.height - this.iheight
    , i = Math.min(h, this._clines.length)
    , fake = this._clines.rtof[i - 1] + 1;

  return this.insertLine(fake, line);
};

Element.prototype.deleteTop = function(n) {
  var fake = this._clines.rtof[this.childBase || 0];
  return this.deleteLine(fake, n);
};

Element.prototype.deleteBottom = function(n) {
  var h = (this.childBase || 0) + this.height - 1 - this.iheight
    , i = Math.min(h, this._clines.length - 1)
    , fake = this._clines.rtof[i];

  n = n || 1;

  return this.deleteLine(fake - (n - 1), n);
};

Element.prototype.setLine = function(i, line) {
  i = Math.max(i, 0);
  while (this._clines.fake.length < i) {
    this._clines.fake.push('');
  }
  this._clines.fake[i] = line;
  return this.setContent(this._clines.fake.join('\n'), true);
};

Element.prototype.setBaseLine = function(i, line) {
  var fake = this._clines.rtof[this.childBase || 0];
  return this.setLine(fake + i, line);
};

Element.prototype.getLine = function(i) {
  i = Math.max(i, 0);
  i = Math.min(i, this._clines.fake.length - 1);
  return this._clines.fake[i];
};

Element.prototype.getBaseLine = function(i) {
  var fake = this._clines.rtof[this.childBase || 0];
  return this.getLine(fake + i);
};

Element.prototype.clearLine = function(i) {
  i = Math.min(i, this._clines.fake.length - 1);
  return this.setLine(i, '');
};

Element.prototype.clearBaseLine = function(i) {
  var fake = this._clines.rtof[this.childBase || 0];
  return this.clearLine(fake + i);
};

Element.prototype.unshiftLine = function(line) {
  return this.insertLine(0, line);
};

Element.prototype.shiftLine = function(n) {
  return this.deleteLine(0, n);
};

Element.prototype.pushLine = function(line) {
  if (!this.content) return this.setLine(0, line);
  return this.insertLine(this._clines.fake.length, line);
};

Element.prototype.popLine = function(n) {
  return this.deleteLine(this._clines.fake.length - 1, n);
};

Element.prototype.getLines = function() {
  return this._clines.fake.slice();
};

Element.prototype.getScreenLines = function() {
  return this._clines.slice();
};

Element.prototype.strWidth = function(text) {
  text = this.parseTags
    ? helpers.stripTags(text)
    : text;
  return this.screen.fullUnicode
    ? unicode.strWidth(text)
    : helpers.dropUnicode(text).length;
};

Element.prototype.screenshot = function(xi, xl, yi, yl) {
  xi = this.lpos.xi + this.ileft + (xi || 0);
  if (xl != null) {
    xl = this.lpos.xi + this.ileft + (xl || 0);
  } else {
    xl = this.lpos.xl - this.iright;
  }
  yi = this.lpos.yi + this.itop + (yi || 0);
  if (yl != null) {
    yl = this.lpos.yi + this.itop + (yl || 0);
  } else {
    yl = this.lpos.yl - this.ibottom;
  }
  return this.screen.screenshot(xi, xl, yi, yl);
};

/**
 * Expose
 */

module.exports = Element;
