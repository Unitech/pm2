// Time units, as found in Java:
// see: http://download.oracle.com/javase/6/docs/api/java/util/concurrent/TimeUnit.html
exports.NANOSECONDS  = 1 / (1000 * 1000);
exports.MICROSECONDS = 1 / 1000;
exports.MILLISECONDS = 1;
exports.SECONDS      = 1000 * exports.MILLISECONDS;
exports.MINUTES      = 60 * exports.SECONDS;
exports.HOURS        = 60 * exports.MINUTES;
exports.DAYS         = 24 * exports.HOURS;
