
console.log('start');

setTimeout(function() {
  console.log('exit');
  process.exit(1);
}, 300);
