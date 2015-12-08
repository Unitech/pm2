
process.on('message', function(packet) {
  if (packet.topic == 'process:msg') {
    process.send({
      topic : 'process:msg',
      data : {
        success : true
      }
    });
  }
});
