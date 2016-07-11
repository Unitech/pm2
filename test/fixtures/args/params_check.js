
process.argv.shift();
process.argv.shift();

process.argv.forEach(function(val, index) {
  console.log(val);
});

setInterval(function() { }, 1000);
