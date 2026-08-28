// Writes 200 numbered ~2KB lines in a single write (> 64KB pipe buffer)
// then stays alive. Used to check log integrity across pipe chunks (#6125).
var lines = [];
for (var i = 0; i < 200; i++)
  lines.push('L' + String(i).padStart(4, '0') + ' ' + 'x'.repeat(1990));
process.stdout.write(lines.join('\n') + '\n');
process.stderr.write(lines.join('\n') + '\n');
setInterval(function() {}, 10000);
