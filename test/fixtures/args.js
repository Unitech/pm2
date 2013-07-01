

if (process.argv.indexOf('-d') == -1 || process.argv.indexOf('-a') == -1) {
  process.exit();
} else {
  setInterval(function() {
    console.log('ok');
  }, 500);  
}
