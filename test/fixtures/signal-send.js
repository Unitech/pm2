
setInterval(function() {
}, 1000);

process.on('message', function (msg) {
  console.log(msg);
});
