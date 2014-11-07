var God = require('./God.js');
var cst = require('../constants.js');

var Methods = {};
var timer = null;

var tasks = function() { // do things here
  console.log('COUCOU');
}

Methods.start = function() {
  timer = setInterval(tasks, 1000 || cst.WORKER_INTERVAL);
}

Methods.stop = function() {
  if (timer !== null)
    clearInterval(timer);
}

module.exports = Methods;
