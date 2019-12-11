
setTimeout(function() {
  process.send({
    'cron_restart' : 1
  });
}, 1000);

process.on('SIGINT', function() {
  console.log('SIGINT signal received');
  setTimeout(function() {
    process.exit(0);
  }, 1000);
});

setInterval(function() {
}, 100);
