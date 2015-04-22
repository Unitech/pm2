var paths = require('module').globalPaths;

if (Array.isArray(paths)) {
  var found = false;
  paths.forEach(function(elem) {
    if (elem === process.env.NODE_PATH) {
      found = true;
    }
  });

  if (!found)
    process.exit(1);
  else
    setInterval(function keepAlive() {}, 10000);
}
else {
  process.exit(1);
}
