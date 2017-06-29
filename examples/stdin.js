
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.prompt();

rl.on('line', (data) =>{
  console.log('Received data');
  console.log(data);
});

setInterval(() => {
  //console.log('Yes');
}, 2000);
