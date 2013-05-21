

setInterval(function() {
  console.log('ok');
}, 800);

setTimeout(function() {
  process.exit(-1);
}, 3000);