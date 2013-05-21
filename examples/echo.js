
setInterval(function() {
    console.log('ok');
    console.error('merde');
}, 500);

setTimeout(function() {
    throw new Error('eh merde');
}, 3000);
