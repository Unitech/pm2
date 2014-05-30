var ipm2   = require('pm2-interface');

var axon   = require('axon');
var rpc    = require('pm2-axon-rpc');
var crypto = require('crypto');

var util   = require('util');
var fs     = require('fs');
var debug  = require('debug')('interface:driver'); // Interface
var os     = require('os');
var cst    = require('../constants.js');
var pkg    = require('../package.json');

var sock   = axon.socket('pub');
var rep    = axon.socket('rep');

var ipm2a;
var server;

var Interactor        = module.exports = {};

var MACHINE_NAME = '';
var PUBLIC_KEY   = '';
var SECRET_KEY   = '';
var REMOTE_CONNECTED    = false;

var buffer = [];

const CIPHER_ALGORITHM = 'aes256';
const SEND_DATA_INTERVAL = 1000;

function decipherMessage(msg) {
  var ret = {};

  try {
    var decipher = crypto.createDecipher(CIPHER_ALGORITHM, SECRET_KEY);
    var decipheredMessage = decipher.update(msg, 'hex', 'binary');
    decipheredMessage += decipher.final("binary");
    ret = JSON.parse(decipheredMessage);
  } catch(e) {
    return null;
  }

  return ret;
};

function cipherMessage(data, key) {
  try {
    var cipher       = crypto.createCipher(CIPHER_ALGORITHM, key);
    var cipheredData = cipher.update(data, "binary", "hex");
    cipheredData += cipher.final("hex");
    return cipheredData;
  } catch(e) {
    return null;
  }
}

var ReverseInteract = {
  onMessage : function() {
    if (!this.socket) return console.error('Reverse interaction not initialized');
    var self = this;

    this.socket.data('ask', function(raw_msg) {
      debug('ask method done');
      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        self.socket.send('ask:rep', {
          success : true,
          machine_name : MACHINE_NAME,
          public_key   : PUBLIC_KEY
        });
      } else {
        var ciphered_data = cipherMessage(JSON.stringify({ machine_name : MACHINE_NAME }), SECRET_KEY);
        if (!cipherMessage) return console.error('Got wrong ciphering data %s %s', MACHINE_NAME, SECRET_KEY);
        self.socket.send('ask:rep', {
          data : ciphered_data,
          public_key   : PUBLIC_KEY
        });
      }

    });

    this.socket.data('trigger:action', function(raw_msg) {
      var msg;
      debug('new action received');

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test')
        msg = raw_msg;
      else
        msg = decipherMessage(raw_msg);

      ipm2a.rpc.msgProcess({
        id : msg.process_id,
        msg : msg.action_name
      }, function(err, data) {
        if (err) {
          return self.socket.send('trigger:action:failure', {
            success : false,
            err : err,
            id : msg.process_id,
            action_name : msg.action_name
          });
        }
        console.log('[REVERSE INTERACTOR] Message received from AXM for proc_id : %s and action name %s',
                    msg.process_id, msg.action_name);
        return self.socket.send('trigger:action:success', {
          success : true,
          id : msg.process_id,
          action_name : msg.action_name
        });
      });
    });
  },
  listen : function(remote_port, remote_host) {
    if (!remote_port || !remote_host) return console.error('Missing parameters');
    var self = this;
    var nssocket = require('nssocket');

    console.log('[REVERSE INTERACTOR] Connecting to %s:%s', remote_host, remote_port);

    this.socket = new nssocket.NsSocket({
      type: 'tcp4'
    });

    this.socket.on('error', function(dt) {
      console.error('[REVERSE INTERACTOR][ERROR]', dt);
    });

    this.socket.on('close', function(dt) {
      console.log('[REVERSE INTERACTOR][CLOSE] connection closed');

      setTimeout(function() {
        self.socket.connect(remote_port, remote_host);
      }, 2000);
    });

    this.socket.on('start', function() {
      console.log('[REVERSE INTERACTOR][START] Reverse connected to %s:%s', remote_host, remote_port);
    });

    self.onMessage();

    this.socket.connect(remote_port, remote_host);
  }
};

var Interact = {
  redirect_event : function() {
    var process_id = '';

    ipm2a.bus.on('*', function(event, data){
      if (data.pm2_env)
        delete data.pm2_env.env;

      switch (event) {
      case 'process:online':
      case 'process:exit':
      case 'process:exit:overlimit':
        process_id = Filter.get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        data = Filter.filter_process_state_change(data);
        Interact.bufferData(event, data, process_id);
        break;
      case 'process:exception':
        process_id = Filter.get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        data = Filter.filter_exception(data);
        Interact.bufferData(event, data, process_id);
        break;
      case 'axm:action':
        break;
      case 'log:err':
      case 'log:out':
        process_id = Filter.get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        data = Filter.filter_log(data);
        Interact.bufferData(event, data, process_id);
        break;
      default:
        if (data.process && data.process.pm2_env)
          process_id = Filter.get_process_id(data.process.pm2_env.name, data.process.pm2_env.pm_id);
        else if (data.pm2_env)
          process_id = Filter.get_process_id(data.pm2_env.name,data.pm2_env.pm_id);
        else
          process_id = null;
        delete data.process;

        Interact.bufferData(event, data.data, process_id);
      }
    });
  },
  send_status_data : function(cb) {
    ipm2a.rpc.getMonitorData({}, function(err, processes) {
      if (!processes) return console.error('Cant access to getMonitorData RPC PM2 method');

      var ret;

      if ((ret = Filter.filter_monitoring(processes)))
        Interact.bufferData('monitoring', ret) ;

      Interact.bufferData('status', Filter.filter_status(processes));

      if (cb) return cb();
      return false;
    });
  },
  /////////////////////////
  // COMMANDS FOR WORKER //
  /////////////////////////
  start_worker : function() {
    /**
     * Send bufferized data at regular interval
     */
    this.send_timer = setInterval(function() {
      Interact.send_data();
    }, SEND_DATA_INTERVAL);
  },
  stop_workers : function() {
    var self = this;

    clearInterval(self.send_timer);
  },
  send_data : function() {
    var data = {};
    var encrypted_data;
    var cipher = crypto.createCipher(CIPHER_ALGORITHM, SECRET_KEY);

    Interact.send_status_data(function() {
      /**
       * Cipher data with AES256
       */

      if (process.env.NODE_ENV && process.env.NODE_ENV == 'test') {
        data = {
          public_key : PUBLIC_KEY,
          sent_at    : new Date(),
          data       : {
            buffer      : buffer,
            server_name : MACHINE_NAME
          }
        };
      }
      else {
        var cipheredData = cipher.update(JSON.stringify({
          buffer      : buffer,
          server_name : MACHINE_NAME
        }), "binary", "hex");

        cipheredData += cipher.final("hex");

        data = {
          public_key : PUBLIC_KEY,
          sent_at    : new Date(),
          data       : cipheredData
        };
      }
      sock.send(JSON.stringify(data));

      debug('Buffer with length %d sent', buffer.length);
      buffer = [];
    });
  },
  bufferData : function(event, data, process_id) {
    var buff_data = {
      at    : new Date(),
      event : event,
      data  : data
    };

    if (process_id) {
      buff_data['process_id'] = process_id;
      // This is ugly
      buff_data['process_name'] = process_id.split(':')[1];
    }

    buffer.push(buff_data);
    debug('Event %s bufferized', event);
  },
  listenToLocalPM2 : function() {
    ipm2a = ipm2({bind_host: 'localhost'});

    console.log('Connecting to local PM2');

    ipm2a.on('ready', function() {
      console.log('Succesfully connected to local PM2');
      /**
       * Forward all events to remote
       */
      Interact.redirect_event();
      Interact.start_worker();
    });

    ipm2a.on('reconnecting', function() {
      console.error('Disconnected from PM2 - Reconnecting');
      Interact.stop_workers();
      ipm2a.removeAllListeners();
      ipm2a.disconnect();
      if (ipm2a)
        ipm2a = undefined;
      setTimeout(Interact.listenToLocalPM2, 1000);
    });
  }
};


////////////////////////////////////////////////
// MISC METHODS TO DAEMONIZE/EXPOSE INTERACTOR //
////////////////////////////////////////////////

Interactor.interact = function(port, host) {
  var vs_socket = sock.connect(port, host);

  console.log('[PUB INTERACT] Connecting to %s:%s', host, port);

  vs_socket.on('connect', function() {
    console.log('[PUB INTERACT] Successfully connected to %s:%s', host, port);
    REMOTE_CONNECTED = true;
  });

  vs_socket.on('error', function(e) {
    console.error('[PUB INTERACT]', e);
  });

  vs_socket.on('disconnect', function() {
    console.log('[PUB INTERACT] Disconnected');
  });

  Interact.listenToLocalPM2();
};

Interactor.expose = function() {
  console.log('Launching Interactor exposure');

  server = new rpc.Server(rep);
  rep.bind(cst.INTERACTOR_RPC_PORT);

  server.expose({
    kill : function(cb) {
      console.log('Killing interactor');
      cb();
      setTimeout(function() { process.exit(cst.SUCCESS_EXIT) }, 500);
    },
    getInfos : function(cb) {
      return cb(null, {
        machine_name : MACHINE_NAME,
        public_key   : PUBLIC_KEY,
        secret_key   : SECRET_KEY,
        remote_host  : cst.REMOTE_HOST,
        remote_port  : cst.REMOTE_PORT,
        remote_connected : REMOTE_CONNECTED
      });
    }
  });
  console.log('Methods exposed from Interactor Daemon');
};

Interactor.autoDaemonize = function() {
  console.log('Daemonizing Interactor.js');

  var stdout = fs.createWriteStream(cst.INTERACTOR_LOG_FILE_PATH, {
    flags : 'a'
  });

  process.stderr.write = function(string) {
    stdout.write(new Date().toISOString() + ' : ' + string);
  };

  process.stdout.write = function(string) {
    stdout.write(new Date().toISOString() + ' : ' + string);
  };

  if (process.send)
    process.send({
      part    : 'Interactor - Watchdog',
      online  : true,
      success : true,
      pid     : process.pid
    });

  MACHINE_NAME = process.env.PM2_MACHINE_NAME;
  PUBLIC_KEY   = process.env.PM2_PUBLIC_KEY;
  SECRET_KEY   = process.env.PM2_SECRET_KEY;

  if (!MACHINE_NAME) {
    console.error('You must provide a PM2_MACHINE_NAME environment variable');
    process.exit(cst.ERROR_EXIT);
  }
  else if (!PUBLIC_KEY) {
    console.error('You must provide a PM2_PUBLIC_KEY environment variable');
    process.exit(cst.ERROR_EXIT);
  }
  else if (!SECRET_KEY) {
    console.error('You must provide a PM2_SECRET_KEY environment variable');
    process.exit(cst.ERROR_EXIT);
  }

  Interactor.expose();

  if (cst.DEBUG) {
    ReverseInteract.listen(cst.REMOTE_REVERSE_PORT, '127.0.0.1');
    Interactor.interact(3900, '127.0.0.1');
  }
  else {
    ReverseInteract.listen(cst.REMOTE_REVERSE_PORT, cst.REMOTE_HOST);
    Interactor.interact(cst.REMOTE_PORT, cst.REMOTE_HOST);
  }
};


/////////////////
// FILTER DATA //
/////////////////
var Filter = {
  get_process_id : function(name, id) {
    return MACHINE_NAME + ':' + name + ':' + id;
  },
  filter_status : function(processes) {
    var formated_status = {};
    var filter_procs    = [];

    processes.forEach(function(proc) {
      filter_procs.push({
        pid          : proc.pid,
        name         : proc.pm2_env.name,
        interpreter  : proc.pm2_env.exec_interpreter,
        restart_time : proc.pm2_env.restart_time,
        created_at   : proc.pm2_env.created_at,
        exec_mode    : proc.pm2_env.exec_mode,
        watching     : proc.pm2_env.watch,
        unstable_restarts : proc.pm2_env.unstable_restarts,
        pm_uptime    : proc.pm2_env.pm_uptime,
        status       : proc.pm2_env.status,
        pm_id        : proc.pm2_env.pm_id,
        cpu          : Math.floor(proc.monit.cpu) || 0,
        memory       : Math.floor(proc.monit.memory) || 0,
        process_id   : Filter.get_process_id(proc.pm2_env.name, proc.pm2_env.pm_id),
        axm_actions  : proc.pm2_env.axm_actions || []
      });
    });

    formated_status = {
      process : filter_procs,
      server : {
        pm2_version : pkg.version,
        loadavg   : os.loadavg(),
        total_mem : os.totalmem(),
        free_mem  : os.freemem(),
        cpu       : os.cpus(),
        hostname  : os.hostname(),
        uptime    : os.uptime(),
        type      : os.type(),
        platform  : os.platform(),
        arch      : os.arch()
      }
    };
    return formated_status;
  },
  filter_monitoring : function(processes) {
    var filter_procs = {};
    if (!processes) return null;

    processes.forEach(function(proc) {
      filter_procs[Filter.get_process_id(proc.pm2_env.name,proc.pm2_env.pm_id)] = [proc.monit.cpu, proc.monit.memory];
    });

    var monit = {
      loadavg   : os.loadavg(),
      total_mem : os.totalmem(),
      free_mem  : os.freemem(),
      processes : filter_procs
    };

    return monit;
  },
  filter_exception : function(data) {
    return data.data.err;
  },
  /**
   * Filter data to send when process go online or offline
   */
  filter_process_state_change : function(data) {
    var state = {
      state        : data.process.pm2_env.status,
      name         : data.process.pm2_env.name,
      pm_id        : data.process.pm2_env.pm_id,
      restart_time : data.process.pm2_env.restart_time,
      uptime       : data.process.pm2_env.uptime
    };
    return state;
  },
  /**
   * Filter log
   */
  filter_log : function(log) {
    return log.data;
  }
};

/**
 * MAIN
 */
if (require.main === module) {
  debug('Launching interactor');
  process.title = 'PM2: AXM Interactor';
  Interactor.autoDaemonize();
}
