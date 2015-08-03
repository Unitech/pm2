
module.exports = function(pmx) {
  var TIME_INTERVAL = 1000;

  var oldTime = process.hrtime();

  var histogram = pmx.probe().histogram({
    name        : 'Loop delay',
    measurement : 'mean',
    unit        : 'ms'
  });

  setInterval(function() {
    var newTime = process.hrtime();
    var delay = (newTime[0] - oldTime[0]) * 1e3 + (newTime[1] - oldTime[1]) / 1e6 - TIME_INTERVAL;
    oldTime = newTime;
    histogram.update(delay);
  }, TIME_INTERVAL);
};
