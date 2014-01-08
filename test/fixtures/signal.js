

setInterval(function() {
  console.log('ok');
}, 1000);

process.on('SIGUSR2', function () {
  console.log('SIGUSR2');
});
