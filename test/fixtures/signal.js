setInterval(function() {
  console.log('ok');
}, 30);

process.on('SIGUSR2', function () {
  console.log('SIGUSR2');
});
