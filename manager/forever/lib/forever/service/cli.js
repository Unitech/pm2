/*
 * cli.js: Handlers for the foreverd CLI commands.
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var utile = require('utile'),
    flatiron = require('flatiron'),
    optimist = require('optimist'),
    forever = require('../../forever'),
    Service = require('./service'),
    argv;

var cli = exports;

var app = flatiron.app;

app.use(flatiron.plugins.cli, {
  usage: forever.cli.usage
});

app.config.argv().env();

var service = new Service({
  adapter: optimist.argv.adapter
});

app.cmd('install', cli.install = function () {
  service.install(function onInstall(err) {
    if (err) {
      forever.log.error(err);
    }
    else {
      forever.log.info('foreverd installed');
    }
  });
});

//TODO
app.cmd('run', cli.run = function () {
  service.load(function () {
    service.run();
  });
});

app.cmd('uninstall', cli.uninstall = function () {
  service.uninstall();
});

app.cmd(/add (.*)/, cli.add = function (file) {
  service.add(file, forever.cli.getOptions(file));
});

//TODO
app.cmd(/remove (.*)/, cli.remove = function (file) {
  service.remove(file, forever.cli.getOptions(file));
});

app.cmd('start', cli.start = function () {
  service.start();
});

//TODO
app.cmd('stop', cli.stop = function () {
  service.stop();
});

app.cmd('restart', cli.restart = function () {
  service.restart();
});

app.cmd('list', cli.list = function () {
  service.list(function (err, applications) {
    if (err) {
      app.log.error('Error running command: ' + 'list'.magenta);
      app.log.error(err.message);
      err.stack && err.stack.split('\n').forEach(function (line) {
        app.log.error(line);
      })
      return;
    }
    
    applications.forEach(function printApplication(application) {
      console.log(application.monitor.uid, application.monitor.command, application.file, application.monitor.child.pid, application.monitor.logFile, application.monitor.pidFile);
    });
  });
});

app.cmd('pause', cli.pause = function () {
  service.pause();
});

app.cmd('resume', cli.resume = function () {
  service.resume();
});

cli.startCLI = function () {
  app.start();
};

