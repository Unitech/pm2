
var axm = require('@pm2/io');

setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('Exitasdsadasdsda unacepted 222222 !!');
}, 2000);
