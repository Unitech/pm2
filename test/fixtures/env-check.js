/**
 * Test fixture that outputs its environment variables as JSON.
 * Used to verify that object properties are not passed as
 * "[object Object]" to subprocess environment variables.
 *
 * @see https://github.com/Unitech/pm2/issues/6073
 */

// Output env vars so tests can verify them
process.send && process.send({
  type: 'env:report',
  env: process.env
});

// Keep the process alive
setInterval(function keepAlive() {
  // intentionally empty
}, 100);
