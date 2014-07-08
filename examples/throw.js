
setTimeout(function() {
  console.log('log message from echo auto kill');
  throw new Error('Exitasdsadasdsda unacepted !!');
}, 2000);
