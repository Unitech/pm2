

setTimeout(function() {
  process.send({
    'cron_restart' : 1
  });
}, 1000);

process.on('SIGINT', function() {
  console.log('SIGINT signal received');
});

setInterval(function() {
}, 100);
