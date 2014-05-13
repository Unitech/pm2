
var axon = require('axon');
var sock = axon.socket('pub');
var os   = require('os');
var fs   = require('fs');
var cst  = require('../constants.js');
var debug = require('debug')('pm2:watchdog');

var WatchDog = {};

WatchDog.refuse = function() {
  sock.send(JSON.stringify({
    type : 'pm2:refuse',
    data : {
      email : 'none'
    }
  }));
};

function generateId() {
  var crypto = require('crypto');
  var os     = require('os');

  var parts = [os.hostname(), process.pid, +(new Date)];
  var hash = crypto.createHash('md5').update(parts.join(''));
  return hash.digest('hex');
}

WatchDog.createConfFile = function(email, cb) {
  var dt = {
    email : email,
    unique_id : generateId()
  };

  fs.writeFile(cst.WATCHDOG_FILE, JSON.stringify(dt), function(err) {
    if (err) {
      console.error('[WatchDog]', err);
    }
    return cb(null, dt);
  });
};

WatchDog.unsubscribe = function(cb) {
  try {
    fs.unlink(cst.WATCHDOG_FILE, function (err) {
      if (err) console.error(err);
      return cb();
    });
  } catch(e) {
    console.log('[WatchDog] You are already unsubscribed');
  }
};

WatchDog.kill = function() {
  sock.send(JSON.stringify({
    type : 'pm2:kill',
    data : {
      unique_id : WatchDog.conf.unique_id,
      email : WatchDog.conf.email
    }
  }));
};

WatchDog.getConf = function(cb) {
  try {
    fs.readFile(cst.WATCHDOG_FILE, function(err, data) {
      if (err) {
        console.error(err);
        return cb(err);
      }
      else {
        return cb(null, JSON.parse(data));
      }
      return false;
    });
  } catch(e) {
    console.error(e);
    return cb(e);
  }
  return false;
};

WatchDog.interaction = function() {
  debug('Connected, interacting');

  sock.send(JSON.stringify({
    type : 'pm2:subscribe',
    data : {
      unique_id : WatchDog.conf.unique_id,
      email : WatchDog.conf.email,
      hostname : os.hostname()
    }
  }));

  this.timer = setInterval(function() {
    debug('Sending alive');

    sock.send(JSON.stringify({
      type : 'pm2:heartbeat',
      data : {
        unique_id : WatchDog.conf.unique_id
      }
    }));
  }, 10000);
};

WatchDog.connect = function() {
  var self = this;

  debug('Initializing watchdog');

  WatchDog.getConf(function(err, data) {
    if (err) return false;

    debug('Got conf %j', data);

    if (!(data.email || data.unique_id)) return console.error('[WatchDog] Missing parameter');

    WatchDog.conf = data;

    var vs_socket;

    if (cst.DEBUG)
      vs_socket = sock.connect(cst.WATCHDOG_PORT);
    else
      vs_socket = sock.connect(cst.WATCHDOG_PORT, cst.WATCHDOG_URL);

    vs_socket.on('connect', function() {
      WatchDog.interaction();
    });

    vs_socket.on('reconnect attempt', function() {
      clearInterval(self.timer);
      debug('Reconnecting');
    });

    return false;
  });
};

module.exports = WatchDog;
