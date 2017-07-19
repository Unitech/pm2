
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.prompt();

rl.on('line', function(line) {
  console.log('Line %s received', line);
});

setInterval(function() {
}, 100);
