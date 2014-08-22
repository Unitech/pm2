

setInterval(function() {
  console.log('log message from echo.js');
}, 1500);

setTimeout(function() {
  setInterval(function() {
    console.error('err msg from echo.js');
  }, 1500);
}, 750);
