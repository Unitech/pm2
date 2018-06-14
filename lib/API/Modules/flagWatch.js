var fs = require('fs');

function handleFolders(folder, mas)
{
  if (fs.lstatSync(folder) && fs.lstatSync(folder).isDirectory())
  {
    fs.readdirSync(folder).forEach(file => {
      if(fs.existsSync(folder + file + '/'))
        handleFolders(folder + file + '/', mas);
      else
          mas.push(folder + file);
    });
  } else {
  	if (fs.lstatSync(folder).isFile()) {
  		mas.push(folder);
  	}
  }
}

function filterIgnoreArgs(rawArgs) {
	var ignoreIndex = rawArgs && rawArgs.indexOf("--ignore-watch") !== -1 ? rawArgs.indexOf("--ignore-watch") : -1;
	var ignoreEndIndex = rawArgs.length;

	if (!rawArgs || ignoreIndex === -1 || rawArgs.length === 0) {
		return [];
	}

	for (var i = ignoreIndex + 1; i < rawArgs.length; i++) {
		if (rawArgs[i][0] === '-') {
			ignoreEndIndex = i;
			break ;
		}
	}

	return rawArgs.slice(ignoreIndex + 1, ignoreEndIndex);
}

module.exports.handleFolders = handleFolders;
module.exports.filterIgnoreArgs = filterIgnoreArgs;
