var blessed = require('blessed');

var IProbe = function() {
  if (!(this instanceof IProbe))
    return new IProbe();

  this.screen = blessed.screen({
    autoPadding: true,
    smartCSR: true
  });

  this.screen.title = 'PM2 realtime probes';

  this.box = blessed.box({
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    scrollbar: {
      fg: 'red',
      ch: '|'
    },

    top: 'center',
    left: 'center',
    width: '100%',
    height: '100%',
    content: 'Fetching probes...',
    align : "center",
    valign : "middle",
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: '#33ffff',
      bg: 'black',
      border: {
        fg: '#33ffff'
      },
    },
  });

  this.screen.append(this.box);

  this.screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });
  this.box.focus();
  this.screen.render();
};

IProbe.prototype.refresh = function(content) {
  if (!content || !content.length)
    return;

  this.box.setContent(content.join('\n'));
  this.screen.render();
};

module.exports = IProbe;
