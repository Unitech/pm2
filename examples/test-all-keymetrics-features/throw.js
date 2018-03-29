
var axm = require('pmx');

axm.catchAll();

setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('Exitasdsadasdsda unacepted 222222 !!');
}, 2000);
