var fs          = require('fs');
var conf         = require('../../../constants.js');

function  find_extensions(folder, ext, ret)
{
    try {
      fs.accessSync(folder, fs.constants.R_OK);
    } catch (err) {
      return;
    }
    if(fs.statSync(folder).isDirectory() && folder.indexOf('node_modules') == -1 && (fs.statSync(folder)["mode"] & 4))
    {
      fs.readdirSync(folder).forEach(file => {
          var tmp;
          if(Number.parseInt(folder.lastIndexOf('/') + 1) === folder.length)
            tmp = folder + file;
          else
            tmp = folder + '/' + file;
          if(fs.statSync(tmp).isDirectory())
            find_extensions(tmp, ext, ret);
          else
          {
          var p = true;
          for(var i = 0; i < ext.length;i++)
            if(ext[i].test(file))
              p = false;
          if(p)
            ret.push(folder +  '/' + file);
          }
      });
  }
}

module.exports.make_available_extension = function  make_available_extension(opts, ret)
{
  if(typeof opts == 'object'  && typeof ret == 'object')
  {
    var mas = opts.ext.split(',');
    for(var i = 0;i < mas.length;i++)
      mas[i] = '.' + mas[i];
    var res = [];
    for(var i = 0;i < mas.length;i++)
      res[i] = new RegExp(mas[i] + '$');
    find_extensions(process.cwd(), res, ret);
  }
}
