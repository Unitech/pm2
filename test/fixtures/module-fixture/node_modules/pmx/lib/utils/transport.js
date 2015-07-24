
var debug     = require('debug')('axm:transport');
var stringify = require('json-stringify-safe');

var Transport = module.exports = {};

function ipcSend(args, print) {
  /**
   * For debug purpose
   */
  if (process.env.MODULE_DEBUG)
    console.log(args);

  if (!process.send) {
    var output = args.data;
    delete output.__name;
    return false;
  }


  try {
    process.send(JSON.parse(stringify(args)));
  } catch(e) {
    console.error('Process disconnected from parent !');
    console.error(e.stack || e);
    process.exit(1);
  }
};

Transport.send = function(args, print) {
  if (!print) print = false;

  ipcSend(args, print);
};
