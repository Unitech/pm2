/**
 * widget.js - high-level interface for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

var widget = exports;

// Trimmed registry: pm2 only uses screen/list/box/text (see
// lib/API/Dashboard.js). The other upstream widgets (form & inputs,
// tables, images, terminal, video, bigtext, filemanager, layout, line…)
// have been removed from this vendored copy.
// ScrollableBox/ScrollableText/Log are kept because they are pulled in by
// element.js (scrollable elements) and screen.js (the F12 debug log).
widget.classes = [
  'Node',
  'Screen',
  'Element',
  'Box',
  'Text',
  'ScrollableBox',
  'ScrollableText',
  'List',
  'Log'
];

widget.classes.forEach(function(name) {
  var file = name.toLowerCase();
  widget[name] = widget[file] = require('./widgets/' + file);
});

widget.aliases = {};
