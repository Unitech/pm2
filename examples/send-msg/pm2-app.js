
process.on('message', function(packet) {
  process.send({
    type : 'process:msg',
    data : {
      success : true
    }
  });
});
