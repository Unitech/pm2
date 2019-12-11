
process.stdout.write('outwrite', 'utf8', function() {
  console.log('outcb');
});

process.stderr.write('errwrite', 'utf8', function() {
  console.log('errcb');
});

setInterval(function() {
  process.stdout.write('outwrite', 'utf8', function() {
    console.log('outcb');
  });

  process.stderr.write('errwrite', 'utf8', function() {
    console.log('errcb');
  });
}, 1000)
