// public api wrapper

var util = require('util')
var EE = require('events').EventEmitter
var CLI = require('./CLI')
var Common = require('./Common')

module.exports = PM2
module.exports.PM2 = PM2
module.exports.PM2App = PM2App

function PM2() {
  if (!(this instanceof PM2)) return new PM2();
  this._connected = false;
  this._connecting = false;
  this._actions = 0;
}

util.inherits(PM2, EE);

PM2.prototype._autoconnect = function(cb) {
  this._actions++;
  if (!this._connected) {
    if (!this._connecting) {
      this._connecting = true;
      CLI.connect(function() {
        this._connecting = false;
        this._connected = true;
        this.emit('connect');
      }.bind(this));
    }
    this.once('connect', cb);
  } else {
    process.nextTick(cb);
  }
  return this;
}

PM2.prototype._autodisconnect = function() {
  this._actions--;
  process.nextTick(function() {
    if (this._actions <= 0 && this._connected && !this._connecting) {
      this._connected = false;
      CLI.disconnect(function() {
        this.emit('disconnect');
      }.bind(this));
    }
  }.bind(this));
  return this;
}

PM2.prototype.app = function(config) {
  var app = PM2App(config);
  var self = this;
  app.start = function(cb) {
    self.start(app._config.script, app._config, function() {
      if (cb) cb.apply(self, arguments)
    })
  }
  return app
}

Object.keys(CLI).forEach(function(name) {
  if (PM2.prototype[name]) return;
  PM2.prototype[name] = function() {
    var args = [], cb;
    for (var i=0; i<arguments.length; i++) {
      args[i] = arguments[i];
    }
    if (typeof(args[i-1]) === 'function') {
      cb = args.pop();
    } else {
      cb = function(){};
    }
    args.push(function() {
      cb.apply(this, arguments);
      this._autodisconnect();
    }.bind(this));

    return this._autoconnect(function() {
      CLI[name].apply(CLI, args);
    });
  }
});

function PM2App(config) {
  if (!(this instanceof PM2App)) return new PM2App(config);
  if (typeof(config) === 'string') config = {
    name: config,
    script: config,
  };
  this._config = config
}

util.inherits(PM2App, EE);

;('node_args name instances error_file out_file pid_file cron_restart' +
' merge_logs watch env run_as_user run_as_group log_date_format' +
' min_uptime max_restarts exec_mode exec_interpreter script').split(' ')
.forEach(function(opt) {
  PM2App.prototype[opt] = function(value) {
    this._config[opt] = value
    return this
  }
});

