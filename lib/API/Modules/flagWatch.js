var fs = require('fs');

function handleFolders(folder, mas) {
  if (!folder || !mas || folder.indexOf("node_modules") !== -1)
    return ;

  try {
    fs.accessSync(folder, fs.constants.R_OK);
  } catch (err) {
    return ;
  }

  if (fs.statSync(folder) && fs.statSync(folder).isDirectory()) {
    fs.readdirSync(folder).forEach(file => {
      if (fs.statSync(folder)["mode"] & 4 === 0)
        return ;
      if (fs.existsSync(folder + file + '/'))
        handleFolders(folder + file + '/', mas);
      else
          mas.push(folder + file);
    });
  } else {
  	if (fs.statSync(folder).isFile()) {
  		mas.push(folder);
  	}
  }
}

module.exports.handleFolders = handleFolders;
