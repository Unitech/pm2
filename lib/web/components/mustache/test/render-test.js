require('./helper');

var fs = require('fs');
var path = require('path');
var _files = path.join(__dirname, '_files');

function getContents(testName, ext) {
  return fs.readFileSync(path.join(_files, testName + '.' + ext), 'utf8');
}

function getView(testName) {
  var view = getContents(testName, 'js');
  if (!view) throw new Error('Cannot find view for test "' + testName + '"');
  return eval(view);
}

function getPartial(testName) {
  try {
    return getContents(testName, 'partial');
  } catch (e) {
    // No big deal. Not all tests need to test partial support.
  }
}

function getTest(testName) {
  var test = {};
  test.view = getView(testName);
  test.template = getContents(testName, 'mustache');
  test.partial = getPartial(testName);
  test.expect = getContents(testName, 'txt');
  return test;
}

// You can put the name of a specific test to run in the TEST environment
// variable (e.g. TEST=backslashes vows test/render-test.js)
var testToRun = process.env.TEST;

var testNames;
if (testToRun) {
  testNames = [testToRun];
} else {
  testNames = fs.readdirSync(_files).filter(function (file) {
    return (/\.js$/).test(file);
  }).map(function (file) {
    return path.basename(file).replace(/\.js$/, '');
  });
}

describe('Mustache.render', function () {
  beforeEach(function () {
    Mustache.clearCache();
  });

  testNames.forEach(function (testName) {
    var test = getTest(testName);

    it('knows how to render ' + testName, function () {
      var output;
      if (test.partial) {
        output = Mustache.render(test.template, test.view, { partial: test.partial });
      } else {
        output = Mustache.render(test.template, test.view);
      }

      assert.equal(output, test.expect);
    });
  });
});
