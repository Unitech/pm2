
setInterval(function() {
  console.log(process.env.ECHO_MSG || 'ok');
}, 100);
