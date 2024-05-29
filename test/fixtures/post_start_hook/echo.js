console.log('app running');

process.stdin.on('data', function(chunk) {
	process.stdout.write(chunk);
});
