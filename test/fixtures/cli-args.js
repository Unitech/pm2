var pm2 = require('../..');
pm2.connect(function (err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  pm2.start('./test/fixtures/insidePm2Process.js', {rawArgs: ['--', 'bar'], force: true, maxRestarts: 1},
    function (err) {
      if (err) {
        console.log(err);
        process.exit(1);
      }
    });
});

