
process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

setInterval(function() {
  console.log('HERE ARE MY ARGS !!! = ', process.argv);
}, 800);

