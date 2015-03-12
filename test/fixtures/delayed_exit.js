var exit = function() {
  console.log("Delay exit in 2 secs");
  setTimeout(function(){
    process.exit();
  }, 2000);
};

process.on('SIGTERM', function() {
  console.log('Got SIGTERM signal.');
  exit();
});

process.on('SIGINT', function() {
  console.log('Got SIGINT signal');
  exit();
});

setInterval(function keepMeAlive() {}, 1000);
