
/*
 * Example of graceful exit that does not listen but sends 'online'
 *
 * $ pm2 gracefulReload all
 */

process.on('message', function(msg) {
  if (msg == 'shutdown') {
    console.log('Closing all connections...');
    setTimeout(function() {
      console.log('Finished closing connections');
      process.exit(0);
    }, 1500);
  }
});

setInterval(function ()
{
  console.log('tick');
}, 4000);

setTimeout(function ()
{
  process.send('online');
}, 2000);
