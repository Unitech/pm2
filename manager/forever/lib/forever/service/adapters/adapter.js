/*
 * adapter.js: Abstract base class used by foreverd service adapters
 *
 * (C) 2010 Nodejitsu Inc.
 * MIT LICENCE
 *
 */
 
var Adapter = module.exports = function Adapter(service) {
  this.service = service;
};

//
// This should install assets to appropriate places for initialization,
// configuration, and storage
//
// The script will be used on startup to load Service
//
// Service should listen on something that the management events
// can respond to in full duplex
//
// The installed adapter should send the following events in nssocket protocol
// to the Service and invoke methods as appropriate
//
Adapter.prototype.install = function install() {
  throw new Error('not implemented');
};

//
// This should do a rollback of install completely except for logs
//
Adapter.prototype.uninstall = function uninstall() {
  throw new Error('not implemented');
};

//
// This should call back with an array of [{file:...,options:...},] to pass to Monitors
//   this will be invoked when foreverd is created (not started)
//
Adapter.prototype.load = function load(callback) {
  throw new Error('not implemented');
};

//
// This should tell the OS to start the service
// this will not start any applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.start = function start(monitors) {
  throw new Error('not implemented');
};

//
// This should tell the OS to start the service
// this will not stop any applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.stop = function stop(monitors) {
  throw new Error('not implemented');
};

//
// This should tell the OS to reply with info about applications in the service
// this will not change any applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.status = function status(monitors) {
  throw new Error('not implemented');
};

//
// This should tell the OS to restart the service
// this will not restart any applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.restart = function restart(monitors) {
  throw new Error('not implemented');
};

//
// This should tell the OS to pause the service
// this will prevent any addition or removal of applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.pause = function pause(monitors) {
  throw new Error('not implemented');
};

//
// This should tell the OS to resume the service
// this will enable any addition or removal of applications
// make sure the adapter is installed and sending events to foreverd's listener
//
Adapter.prototype.resume = function resume(monitors) {
  throw new Error('not implemented');
};