/*
 * service.js: Object responsible for managing the foreverd daemon.
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    events = require('events'),
    forever = require('../../forever'),
    SystemVAdapter = require('./adapters/systemv');

// options
//   directories {log, pid, conf, run, local}
var Service = module.exports = function Service(options) {
  events.EventEmitter.call(this);
  options = options || {};

  var self = this,
      AdapterType;

  this.applications = [
      //{
      //file:
      //options:
      //monitor:
      //}
  ];

  this.servers = [];
  if (typeof options.adapter === 'string') {
    options.adapter = Service.adapter[options.adapter];
  }

  AdapterType = options.adapter || SystemVAdapter;
  this.adapter = new AdapterType(this);
};

util.inherits(Service, events.EventEmitter);

Service.prototype.startServer = function startServer(callback) {
  var socket = path.join(forever.config.get('sockPath'), 'forever.sock'),
      monitors = [],
      self = this,
      server;

  server = dnode(this);
  server.on('error', function onServerError() {
    //
    // TODO: This is really bad.
    //
  });

  server.on('ready', function onServerReady(err) {
    self.listen(server);
    if (callback) {
      if (err) {
        callback(err);
      }
      else {
        callback(null, server, socket);
      }
    }
  });

  server.listen(socket);

  return this;
};

Service.prototype.listen = function listen(server) {
  var dnodeServer = dnode(this);

  this.servers.push(dnodeServer);
  dnodeServer.listen(server);

  return this;
};

Service.prototype.load = function load() {
  var self = this;
  this.adapter.load(function onLoaded(applications) {
    applications.forEach(function startApplication(application, index) {
      var monitor = application.monitor = new forever.Monitor(application.file, application.options);

      monitor.start();
      self.applications.push(application);

      if (index === applications.length - 1) {
        self.listen(path.join(forever.config.get('root'), 'foreverd.sock'));
      }

      self.emit('foreverd::loaded');
    });
  });
  return this;
};

//
// Function add(file, options)
//   add the application to the service manager
//   DOES NOT START THE APPLICATION
//   call's the service manager's add method
//
Service.prototype.add = function add(file, options, callback) {
  if (this.paused) {
    return callback && callback(new Error('foreverd is paused'));
  }

  this.adapter.add(file, options, callback);
};

//
// Function remove(file, options)
//   remove the application from the service manager
//   call's the service manager's remove method
//
Service.prototype.remove = function remove(file, options, callback) {
  if (this.paused) {
    return callback(new Error('foreverd is paused'));
  }

  var applicationsToRemove = this.applications,
      self = this,
      optionStr,
      fileStr;
      
  if (file) {
    fileStr = JSON.stringify(file);
    applicationsToRemove = applicationsToRemove.filter(function compareFile(application) {
      return fileStr !== JSON.stringify(application.file);
    });
  }

  if (options) {
    optionStr = JSON.stringify(options);
    applicationsToRemove = applicationsToRemove.filter(function compareOptions(application) {
      return optionStr !== JSON.stringify(application.options);
    });
  }

  applicationsToRemove.forEach(function removeApplication(application) {
    if (application.monitor) {
      application.monitor.stop();
    }

    self.applications.splice(self.applications.indexOf(application), 1);
  });

  if (callback) {
    callback();
  }
  
  return this;
};

//
// Function install()
//   installs all the required to run foreverd
//   call's the service manager's install(options)
//
Service.prototype.install = function install(callback) {
  this.adapter.install(callback);
  return this;
};

//
// Function uninstall(options)
//   uninstalls all the required to run foreverd
//   call's the service manager's uninstall(options)
//
Service.prototype.uninstall = function uninstall(callback) {
  this.adapter.uninstall(callback);
  return this;
};

//
// Function start()
//   calls the appropriate OS functionality to start this service
//
Service.prototype.start = function start(callback) {
  this.adapter.start(callback);
  return this;
};

//
// Function run()
//   creates monitors for all the services
//
Service.prototype.run = function run(callback) {
  var self = this;
  this.adapter.run(function adapterStarted() {
    self.applications.forEach(function startApplication(application) {
      application.monitor = new forever.Monitor(application.file, application.options);
      application.monitor.start();
    });

    return callback && callback();
  });
  
  return this;
};

//
// Function stop(monitors)
//
Service.prototype.stop = function stop(callback) {
  var self = this;
  this.adapter.start(function adapterStopped() {
    self.applications.forEach(function stopApplication(application) {
      application.monitor.stop();
    });
    
    return callback && callback();
  });

  return this;
};

//
// Function restart()
//
Service.prototype.restart = function restart(callback) {
  var self = this;
  this.adapter.start(function adapterRestarted() {
    self.applications.forEach(function restartApplication(application) {
      application.monitor.restart();
    });

    return callback && callback();
  });

  return this;
};

//
// Function pause()
//   disables adding / removing applications
//
Service.prototype.pause = function pause(callback) {
  this.paused = true;
  if (callback) {
    callback();
  }
  
  return this;
};

//
// Function resume()
//   reenables adding / removing applications
//
Service.prototype.resume = function resume(callback) {
  this.paused = false;
  if (callback) {
    callback();
  }
  
  return this;
};

Service.prototype.list = function list(callback) {
  this.adapter.list(callback);
  return this;
};