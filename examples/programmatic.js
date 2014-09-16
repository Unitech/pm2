var pm2 = require('../');

// Connect or launch PM2
pm2.connect(function(err) {

  // Start a script on the current folder
  pm2.start('./test/fixtures/server.js', { name: 'test' }, function(err, proc) {
    if (err) throw new Error('err');

    // Get all processes running
    pm2.list(function(err, process_list) {
      console.log(process_list);

      // Disconnect to PM2
      pm2.disconnect(function() { process.exit(0) });
    });
  });
})
