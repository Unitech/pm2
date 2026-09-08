// A single big write straight to fd 1, past the pipe buffer, before any
// child_process.spawn (a spawn resets the shared O_NONBLOCK flag and would
// hide the problem). With a non-blocking pipe, writeSync returns after the
// first 64 KB and the rest is lost: pino/sonic-boom retry, naive writers
// and native addons don't.
var fs = require('fs');

console.log('boot');

var lines = '';
for (var i = 1; i <= 200; i++) lines += 'BURST-LINE ' + i + ' ' + 'x'.repeat(1990) + '\n';

var n = fs.writeSync(1, lines);
console.log('BURST-ACCEPTED ' + n + '/' + lines.length);

setInterval(function() {}, 1000);
