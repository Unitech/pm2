
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

console.log('Argv2 = ', process.argv[2]);

setInterval(function() {
  console.log('HERE ARE MY ARGS !!! = ', process.argv);
}, 800);
