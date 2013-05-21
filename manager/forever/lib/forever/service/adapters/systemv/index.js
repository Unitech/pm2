/*
 * index.js: Top-level include for the systemv foreverd service adapter
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    spawn = require('child_process').spawn,
    nssocket = require('nssocket'),
    forever = require('../../../../forever'),
    Adapter = require('../adapter');

//
// Classic init.d script adapter
// Sometimes called inittab, but its origin is called systemv
//
var SystemVAdapter = module.exports = function SystemVAdapter(service) {
  Adapter.call(this, service);
  this.daemonized = false;
};

util.inherits(SystemVAdapter, Adapter);

SystemVAdapter.prototype.install = function install(callback) {
  //
  // Copy the init.d script to the right location
  // TODO Distribution fixes?
  //
  forever.config.set('root', path.join('/var', 'local', 'foreverd'));
  var initdPath = path.join('/etc', 'init.d', 'foreverd'),
      script,
      target;

  try {
    fs.mkdirSync(forever.config.get('root'), '0777');
    fs.mkdirSync(path.join(forever.config.get('root'), 'services'), '0777');
  }
  catch (e) {
    if (e.code !== 'EEXIST') {
      return callback && callback(e);
    }
  }

  try {
    script = fs.createReadStream(path.join(__dirname, 'foreverd'));
    target = fs.createWriteStream(initdPath, { flags: 'w', mode: '0777' });

    script.pipe(target);
    script.on('end', function () {
      var directories = fs.readdirSync('/etc');
      directories.forEach(function (directory) {
        var match = directory.match(/^rc(\d+)\.d$/),
            killOrStart;

        if (match) {
          killOrStart = { 0: true, 1: true, 6: true }[match[1]] ? 'K' : 'S';

          try {
            fs.symlinkSync(initdPath, path.join('/etc', directory, killOrStart + '20foreverd'));
          }
          catch (e) {
            if (e.code !== 'EEXIST') {
              return callback && callback(e);
            }
          }
        }
      });

      return callback && callback();
    });
  }
  catch (e) {
    if (e.code !== 'EEXIST') {
      return callback && callback(e);
    }
  }
};

//
//
//
SystemVAdapter.prototype.load = function load(callback) {
  forever.config.set('root', path.join('/var', 'local', 'foreverd'));
  var serviceFiles = fs.readdirSync(path.join(forever.config.get('root'), 'services')),
      services = [];

  if (serviceFiles.length !== 0) {
    serviceFiles.forEach(function loadServiceFiles(serviceFile, index) {
      var serviceFilePath = path.join(forever.config.get('root'), 'services', serviceFile),
          service = JSON.parse(fs.readFileSync(serviceFilePath)),
          file = service.file,
          options = service.options;

      options.minUptime = 200;
      services.push({
        file: service.file,
        options: service.options
      });
    });
  }

  callback(services);
};

SystemVAdapter.prototype.start = function start(callback) {
  spawn('/etc/init.d/foreverd', ['start']);
  return callback && callback();
};

SystemVAdapter.prototype.run = function run(callback) {
  if (this.daemonized) {
    return callback();
  }

  var self = this,
      pidFilePath = path.join('/var', 'run', 'foreverd.pid'),
      logFilePath = path.join('/var', 'log', 'foreverd');

  process.on('exit', function removePIDFile() {
    try {
      fs.unlinkSync(pidFilePath);
    }
    catch (err) {
      // we are exiting anyway. this may have some noexist error already
    }
  });

  fs.open(logFilePath, 'w+', function serviceLogOpened(err, logFile) {
    if (err) {
      throw err;
    }

    self.service.startServer(function () {
      try {
        //
        // TODO: Create a pseudo-daemon to replace this.
        //
        // daemon.start(logFile);
        // daemon.lock(pidFilePath);
        self.daemonized = true;
        return callback && callback();
      }
      catch (err) {
        console.error(err);
        return callback && callback(err);
      }
    });
  });
};

SystemVAdapter.prototype.add = function add(file, options, callback) {
  forever.config.set('root', path.join('/var', 'local', 'foreverd'));
  //
  // Add descriptor to our service list
  // this is just a json file in $root/services/*.json
  //
  var filePath, service = {
    file: file,
    options: options || {}
  };

  options.appendLog = true;
  filePath = path.join(forever.config.get('root'), 'services', options.uid + '.json');

  fs.writeFile(filePath, JSON.stringify(service), function (err) {
    return callback && callback(err);
  });
};

SystemVAdapter.prototype.list = function list(callback) {
  forever.config.set('root', path.join('/var', 'local', 'foreverd'));
  
  var sockPath = path.join(forever.config.get('root'), 'foreverd.sock'),
      client;
      
  client = dnode.connect(sockPath, function onConnect(remote, client) {
    if (callback) {
      callback(false, remote.applications);
    }
    
    client.end();
  });
  
  client.on('error', function onError(err) {
    if (err.code === 'ECONNREFUSED') {
      try {
        fs.unlinkSync(fullPath);
      }
      catch (ex) { }
      return callback && callback(false, []);
    }

    return callback && callback(err);
  });
};