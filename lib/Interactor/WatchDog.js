
var pm2     = require('../..');
var debug   = require('debug')('interface:watchdog');
var shelljs = require('shelljs');
var csts    = require('../../constants');

process.env.PM2_AGENT_ONLINE = true;

var WatchDog = module.exports = {
  start : function(p) {
    var self = this;
    this.ipm2 = p.conf.ipm2;
    this.relaunching = false;

    pm2.connect(function() {});
    console.log('[WATCHDOG] Launching');
    /**
     * Handle PM2 connection state changes
     */
    this.ipm2.on('ready', function() {
      console.log('[WATCHDOG] Connected to PM2');
      self.relaunching = false;
      self.autoDump();
    });

    this.ipm2.on('reconnecting', function() {
      console.log('[WATCHDOG] PM2 is disconnected - Relaunching PM2');

      if (self.relaunching === true) return console.log('[WATCHDOG] Already relaunching PM2');
      self.relaunching = true;

      if (self.dump_interval)
        clearInterval(self.dump_interval);

      return WatchDog.resurrect();
    });
  },
  resurrect : function() {
    var self = this;

    console.log('[WATCHDOG] Trying to launch PM2 #1');

    shelljs.exec(process.cwd() + '/bin/pm2 resurrect', function() {
      setTimeout(function() {
        self.relaunching = false;
      }, 2500);
    });
  },
  autoDump : function() {
    var self = this;

    this.dump_interval = setInterval(function() {
      if (self.relaunching == true) return false;

      pm2.dump(function(err) {
        if (err) return console.error('[WATCHDOG] Error when dumping');
        debug('PM2 process list dumped');
        return false;
      });
    }, 5 * 60 * 1000);
  }
};
