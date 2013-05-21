/*
 * index.js: Top-level include for the `forever.service` module.
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var fs = require('fs'),
    path = require('path');

var service = exports;

service.Service  = require('./service');
service.adapters = {};

fs.readdirSync(path.join(__dirname, 'adapters')).forEach(function (file) {
  file = file.replace(/\.js/, '');
  service.adapters.__defineGetter__(file, function () {
    return require(__dirname + '/adapters/' + file);
  });
});
