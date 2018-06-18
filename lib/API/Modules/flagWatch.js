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

module.exports.handleFolders = handleFolders;
