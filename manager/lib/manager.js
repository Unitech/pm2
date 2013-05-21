var debug = require('debug')('devops:Manager');


var forever = require('../forever');
var _ = require('underscore');
var path = require('path');
var carcass = require('carcass');
var async = require('async');

module.exports = Manager;

function Manager(){

    function manager(){};

    carcass.mixable(manager);

    manager.mixin(carcass.proto.stack);

    manager.mixin(proto);

    manager.stack = [];

    manager.monitors = [];

    return manager;
}

carcass.mixable(Manager);

var proto = {
    dir: dir,
    use: use,
    start : start,
    startOne: startOne,
    stopOne: stopOne,
    stopAll: stopAll,
    getCurrentProcesses: getCurrentProcesses,
    checkProcess: checkProcess,
    clear: clear
}

function use(item) {
    this.stack.push(item);
    return this;
}

function start(cb) {
    var self = this;
    
    async.map(self.stack, self.startOne.bind(self), function(children) {
        // children.forEach(function(child) {
        //     if (child) self.monitors.push(child);
        // });
        cb();
    });
}

function startOne(item, cb) {
    var self = this;
    item.path = item.script || item.path;
    var options = {
        fork: true,
        max: 1,
        slient: false,
        sourceDir: self._dir || './',
        outFile:  item.script + '.log', // Default is script name 
        errFile: item.script + 'err-echo.log',
        pidFile: item.script + 'echo.log'
    };
    _.extend(options, item);
    console.log(options)
    var monitor = new forever.Monitor(options.path, options);
    monitor.on('start', function() {
        debug("%s has been launched", options.path);
        self.monitors.push(monitor);
        cb(null, monitor);
    });

    monitor.on('stop', function() {
        debug("%s has been stopped", options.path);
        _.without(self.stack, item);
    });
    monitor.start();
}

function stopAll(cb) {
    var self = this;
    async.map(self.monitors, self.stopOne.bind(self), function(error){
        cb();
    });
}

function stopOne(monitor, cb) {

    monitor.on('exit', function() {
        debug('killed')
        cb(null, null);
    });
    monitor.kill();
}

function dir(_dir) {
    this._dir = _dir;
    return this;
}

function getCurrentProcesses(){
    return this.monitors;
}

function checkProcess(pid){
    return forever.checkProcess(pid);
}

function clear(){
    this.stack = [];
    this.monitors = [];
}
