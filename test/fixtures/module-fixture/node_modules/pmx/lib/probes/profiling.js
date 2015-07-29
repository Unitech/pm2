
var debug     = require('debug')('axm:profiling');
var os        = require('os');
var path      = require('path');
var fs        = require('fs');

var Options   = require('../pm2_module.js');

var Profiling = module.exports = {};

Profiling.exposeProfiling = function(pmx, profiler_path) {
  try {
    var profiler = require(profiler_path);
  } catch(e) {
    debug('v8-profiler module not installed', e);
    return false;
  }

  debug('v8-profiler sucessfully enabled');

  /**
   * Tell Keymetrics that profiling is possible
   * (flag available in axm_options object)
   */
  Options.configureModule({
    heapdump : true
  });

  /**
   * Heap snapshot
   */
  pmx.action('km:heapdump', function(reply) {
    var dump_file = path.join(os.tmpDir(), Date.now() + '.heapsnapshot');

    var snapshot = profiler.takeSnapshot('km-heap-snapshot');
    var buffer    = '';

    snapshot.serialize(
      function iterator(data, length) {
        buffer += data;
      }, function complete() {
        fs.writeFile(dump_file, buffer, function (err) {
          debug('Heap dump file flushed (e=', err);

          if (err) {
            return reply({
              success   : false,
              err : err
            });
          }
          return reply({
            success   : true,
            heapdump  : true,
            dump_file : dump_file
          });
        });
      }
    );
  });

  /**
   * CPU profiling snapshot
   */
  var ns_cpu_profiling        = 'km-cpu-profiling';
  var cpu_dump_file = path.join(os.tmpDir(), Date.now() + '.cpuprofile');

  pmx.action('km:cpu:profiling:start', function(reply) {
    profiler.startProfiling(ns_cpu_profiling);
    return reply({ success : true });
  });

  pmx.action('km:cpu:profiling:stop', function(reply) {
    var cpu = profiler.stopProfiling(ns_cpu_profiling);

    fs.writeFile(cpu_dump_file, JSON.stringify(cpu), function(err) {
      if (err) {
        return reply({
          success   : false,
          err : err
        });
      }
      return reply({
        success     : true,
        cpuprofile  : true,
        dump_file   : cpu_dump_file
      });
    });
  });

};

/**
 * Discover v8-profiler
 */
Profiling.detectV8Profiler = function(cb) {
  var require_paths = require.main.paths;

  (function look_for_profiler(require_paths) {
    if (!require_paths[0])
      return cb(new Error('Module not found'));

    var profiler_path = path.join(require_paths[0], 'v8-profiler');

    fs.exists(profiler_path, function(exist) {
      if (exist)
        return cb(null, profiler_path);

      require_paths.shift();
      return look_for_profiler(require_paths);
    });
    return false;
  })(require_paths);
};

Profiling.v8Profiling = function(pmx) {
  Profiling.detectV8Profiler(function(err, profiler_path) {
    if (err)
      return false;
    return Profiling.exposeProfiling(pmx, profiler_path);
  });
};
