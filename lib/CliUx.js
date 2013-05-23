
var Table = require('cli-table');

var UX = module.exports = {};

UX.dispAsTable = function(list) {
  var table = new Table({ head: ["Script", "id", "PID","status", "memory", "out logs", "err logs", "full path"] });
  list.forEach(function(l) {
    var u =  l.opts.script;
    var obj = {};

    obj[l.opts.script] = [
      l.pm_id,
      l.pid,
      l.status,
      l.monit ? l.monit.memory : '',
      l.opts.fileOutput,
      l.opts.fileError,
      l.opts.pm_exec_path
    ];

    table.push(obj);
  });

  console.log(table.toString());
}
