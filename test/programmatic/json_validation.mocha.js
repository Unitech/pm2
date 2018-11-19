
var should = require('should');
var Config = require('../../lib/tools/Config');
var Schema = require('../../lib/API/schema.json');

// Change to current folder
process.chdir(__dirname);

describe('JSON validation tests', function() {
  it('should fail when passing wrong json', function() {
    var ret = Config.validateJSON({
      "exec_interpreter"   : "node",
      "exec_mode"          : "clusasdter_mode",
      "instances"          : "max",
      "log_date_format"    : "YYYY-MM-DD HH:mm Z",
      "max_memory_restart" : "160",
      "merge_logs"         : true,
      "name"               : "hapi_playground",
      "script"             : "chidld.js",
      "cwd"                : "examadsples",
      "node_args"          : "--harmoasdny",
      "ignore_watch"        : ["[\\/\\\\]\\./", "log"],
      "watch"              : "true"
    });

    /**
     * Error about instances to not be an integer
     * Error about watch to not be a boolean
     */
    ret.errors.length.should.eql(2);
  });

  it('should succeed while passing right json', function() {
    var ret = Config.validateJSON({
      "exec_interpreter"   : "node",
      "exec_mode"          : "cluster_mode",
      "instances"          : 0,
      "log_date_format"    : "YYYY-MM-DD HH:mm Z",
      "max_memory_restart" : "160",
      "merge_logs"         : true,
      "error_file"         : "err.file",
      "out_file"           : "out.file",
      "pid_file"           : "pid.file",
      "log_file"           : "my-merged-log-file.log",
      "name"               : "hapi_playground",
      "script"             : "child.js",
      "cwd"                : "examples",
      "node_args"          : "--harmony",
      "max_memory_restart" : "10M",
      "ignore_watch"        : ["[\\/\\\\]\\./", "log"],
      "watch"              : true,
      "node_args"          : ["hey","hay"],
      "env"                : {}
    });

    ret.errors.length.should.eql(0);
  });

  it('should set default values if some attributes not defined', function(done) {
    var default_values = Object.keys(Schema).filter(function(attr) {
      if (Schema[attr].default) return Schema[attr].default;
      return false;
    });

    var ret = Config.validateJSON({
      script : 'test.js',
      name   : 'toto'
    });

    // Returned array should contain also default values
    Object.keys(ret.config).should.containDeep(default_values);
    done();
  });

});
