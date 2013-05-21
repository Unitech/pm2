//
// Display log stream for a specific process
//
var fs = require('fs');

var colors = [
    '\x1B[34m',
    '\x1B[36m',
    '\x1B[32m',
    '\x1B[35m',
    '\x1B[31m',
    '\x1B[30m',
    '\x1B[90m',
    '\x1B[33m'
];

var gl_idx = 0;

var db = [];

function print_data(odb, title, data) {
    var lines = data.split('\n');

    lines.forEach(function(l) {
	if (l)
	    console.log(odb.color + '[%s (l%d)]\x1B[39m %s',
			title,
			odb.l++,
			l);	
    });
};

function stream_log(title, path) {
    try {
	var currSize = 0;//fs.statSync(path).size;
    } catch(e) {
	if (e.code == 'ENOENT')
	    console.log('%s with %s file not found', title, path);
	return;
    }

    var odb = db[title] = {color : colors[gl_idx++], l : 0};
    
    fs.watch(path, function(ev, filename) {
	if (ev == 'rename')
	    return console.error('Renaming file ?');
	
	fs.stat(path, function(err, stat) {
	    var prevSize = stat.size;
	    
	    if (currSize > prevSize) return true;

	    var rstream = fs.createReadStream(path, {
		encoding : 'utf8',
		start : currSize,
		end : prevSize
	    });

	    rstream.on('data', function(data) {
		print_data(odb, title, data);
	    });
	    
	    currSize = stat.size;
	    return true;
	});
	return true;
    });
}

module.exports = stream_log;

// stream_log('probe1', '/home/tknew/.forever/out-probe2.log');
// stream_log('probe2', '/home/tknew/.forever/out-probe1.log');
