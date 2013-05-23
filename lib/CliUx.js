
var Table = require('cli-table');

var sprintf = require('util').format;
var p = require('path');
var UX = module.exports = {};

UX.dispAsTable = function(list) {
  var table = new Table({ head: ["Script", "id", "PID","status", "Restarted", "memory", "err logs"] });
  list.forEach(function(l) {
    var u =  l.opts.script;
    var obj = {};

    obj[p.basename(l.opts.script)] = [
      l.pm_id,
      l.pid,
      l.status,
      l.opts.restart_time ? l.opts.restart_time : 0,
      l.monit ? l.monit.memory : '',
      l.opts.fileError,
    ];

    table.push(obj);
  });

  console.log(table.toString());
}

var timer;

UX.processing = {
  start : function() {
    // Code grabbed from Mocha by Visionmedia/Tj
    // https://github.com/visionmedia/mocha/blob/master/bin/_mocha

    var spinner = 'win32' == process.platform
                ? ['|','/','-','\\']
                : ['◜','◠','◝','◞','◡','◟'];

    function play(arr, interval) {
      var len = arr.length
        , interval = interval || 100
        , i = 0;

      timer = setInterval(function(){
                     var str = arr[i++ % len];
                     process.stdout.write('\u001b[0G' + str);
                   }, interval);
    }

    var frames = spinner.map(function(c) {
                   return sprintf('  \u001b[96m%s \u001b[90mProcessing...\u001b[0m', c);
                 });

    play(frames, 70);
  },
  stop : function() {
    process.stdout.write('\u001b[2K');
    clearInterval(timer);
  }
};