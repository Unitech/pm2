
var path = require('path');
var fs = require('fs');

//
// Resolving path, seing if default ...
//
exports.resolvePaths = function resolvePaths(app) {
  app["pm_exec_path"]    = path.resolve(process.cwd(), app.script);

  fs.statSync(app.pm_exec_path);

  if (app.fileOutput)
    app["pm_out_log_path"] = path.resolve(process.cwd(), app.fileOutput);
  else {
    if (!app.name) {
      console.log('You havent specified log path, please specify at least a "name" field in the JSON');
      process.exit(ERROR_EXIT);
    }
    app["pm_out_log_path"] = path.resolve(DEFAULT_LOG_PATH, [app.name, '-out.log'].join(''));
    app.fileOutput = app["pm_out_log_path"];
  }

  if (app.fileError)
    app["pm_err_log_path"] = path.resolve(process.cwd(), app.fileError);
  else {
    app["pm_err_log_path"] = path.resolve(DEFAULT_LOG_PATH, [app.name, '-err.log'].join(''));
    app.fileError          = app["pm_err_log_path"];
  }

  if (app.pidFile)
    app["pm_pid_path"]     = path.resolve(process.cwd(), app.pidFile);
  else {
    app["pm_pid_path"]     = path.resolve(DEFAULT_PID_PATH, [app.name, '.pid'].join(''));
    app.pidFile            = app["pm_pid_path"];
  }

  fs.existsSync(app.pm_out_log_path);
  fs.existsSync(app.pm_err_log_path);

  return app;
}
