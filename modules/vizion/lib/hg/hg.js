var exec = require("child_process").exec;

var fs   = require("fs");

var cliCommand = require('../cliCommand.js');

var halt = false;

function error(repoType, task, errorMsg, cb) {
	if (halt) return false;

	console.error("[Repo-Parser] An error occured while " + task + " in a " + repoType + " repository: " + errorMsg);
	halt = true;
  return cb("[Repo-Parser] An error occured while " + task + " in a " + repoType + " repository: " + errorMsg);
}

function checkReturn(dataArray, cb) {
	if (halt) {
		return false;
	}
	if (Object.keys(dataArray).length > 6) {
    Object.keys(dataArray).forEach(function(key) {
      if (typeof(dataArray[key]) === 'string') {
        dataArray[key] = dataArray[key].replace(/\n/g, '');
      }
    });
		cb(null, dataArray);
	}
};


module.exports.parse = function parseHg(folder, cb) {
	var data = {};

  data.type = 'mercurial';
  data.commit_history = []; // temporary

	exec(cliCommand(folder, "hg paths default"), function(err, stdout, stderr) {
		if(err !== null) {
			error("mercurial", "fetching path", stderr, cb);
		}
		else {
			data.url = stdout;
			checkReturn(data, cb);
		}
	});
	exec(cliCommand(folder, "hg log --limit 1 --template 'changeset: {rev}:{node|short}\nsummary: {desc}'"), function(err, stdout, stderr) {
		if(err !== null) {
			error("mercurial", "fetching log", stderr, cb);
		}
		else {
			var changeset = stdout.match(/^changeset:\s+([^\n]+)$/m);
			//date = stdout.match(/^date:\s+:([^\n]+)$/m);
			var summary = stdout.match(/^summary:\s+([^\n]+)$/m);
			data.revision = changeset[1];
			data.comment = summary[1];
			//data.update_time = date;
			checkReturn(data, cb);
		}
	});
	exec(cliCommand(folder, "hg branch"), function(err, stdout, stderr) {
		if(err !== null) {
			error("mercurial", "fetching branch", stderr, cb);
		}
		else {
			data.branch = stdout;
			checkReturn(data, cb);
		}
	});
	fs.stat(folder+".hg", function(err, stats) {
		if(err !== null) {
			error("mercurial", "fetching stats", "no error available", cb);
		}
		else {
			data.update_time = stats.mtime;
			checkReturn(data, cb);
		}
	});
}
