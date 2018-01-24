
console.log('start');

setTimeout(function() {
  console.log('exit');
  throw new Error('Exitasdsadasdsda unacepted !!');
}, 300);
