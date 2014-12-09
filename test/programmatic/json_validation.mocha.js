
var Config = require('../../lib/tools/Config');

describe('JSON validation tests', function() {
  it('should fail when passing wrong json', function() {
    var ret = Config.verifyJSON({
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
      "ignoreWatch"        : ["[\\/\\\\]\\./", "log"],
      "watch"              : "true"
    });

    /**
     * Error about instances to not be an integer
     * Error about watch to not be a boolean
     */
    ret.errors.length.should.eql(2);
  });

  it('should succeed while passing right json', function() {
    var ret = Config.verifyJSON({
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
      "ignoreWatch"        : ["[\\/\\\\]\\./", "log"],
      "watch"              : true,
      "node_args"          : ["hey","hay"],
      "env"                : {}
    });

    ret.errors.length.should.eql(0);
  });

});
