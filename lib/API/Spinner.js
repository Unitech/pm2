/**
 * Spinner
 * Handle TTY and non-TTY based terminals
 */

var defaultSpinnerString = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏"
].join('');

var InteractiveSpinner = function(textToShow){
  this.text = textToShow || '';
  this.setSpinnerString(defaultSpinnerString); // use default spinner string
};

InteractiveSpinner.setDefaultSpinnerString = function(value) {
  defaultSpinnerString = value;
};

InteractiveSpinner.prototype.start = function() {
  var current = 0;
  var self = this;
  this.id = setInterval(function() {
    try {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(self.chars[current] + ' ' + self.text);
      current = ++current % self.chars.length;
    } catch(e) { // ignore error if term is not tty, just display nothing
    }
  }, 80);
};

InteractiveSpinner.prototype.setSpinnerString = function(str) {
  this.chars = str.split("");
};

InteractiveSpinner.prototype.stop = function() {
  try {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  } catch(e) {}
  clearInterval(this.id);
};

/**
 * Display dots if non TTY terminal
 */
var StaticSpinner = function(text) {
  console.log(text);
}

StaticSpinner.prototype.start = function() {
  this.interval = setInterval(function() {
    process.stdout.write('.');
  }, 500);
};

StaticSpinner.prototype.stop = function() {
  clearInterval(this.interval);
  console.log();
};

module.exports = function(text) {
  if (process.stdout.isTTY)
    return new InteractiveSpinner(text);
  else
    return new StaticSpinner(text);
};
