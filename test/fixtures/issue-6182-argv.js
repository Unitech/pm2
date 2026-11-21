// Writes the node flags this worker really started with (#6182)

var fs = require('fs');
var path = require('path');

var file = path.join(process.env.ARGV_DUMP_DIR, process.env.name + '-' + process.pid + '.json');

// written then renamed: the test polls for the files
fs.writeFileSync(file + '.tmp', JSON.stringify({ name: process.env.name, execArgv: process.execArgv }));
fs.renameSync(file + '.tmp', file);

setInterval(function() {}, 1000);
