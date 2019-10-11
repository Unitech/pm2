
var fs = require('fs')

var getUsers = function() {
  return fs.readFileSync('/etc/passwd')
    .toString()
    .split('\n')
    .filter(function (user) {
      return user.length && user[0] != '#';
    })
    .reduce(function(map, user) {
      var fields = user.split(':');

      map[fields[0]] = map[fields[2]] = {
        username : fields[0],
        password : fields[1],
        userId : fields[2],
        groupId : fields[3],
        name : fields[4],
        homedir : fields[5],
        shell : fields[6]
      };

      return map
    }, {})
}

var getGroups = function(cb) {
  var groups

  try {
    groups = fs.readFileSync('/etc/group')
  } catch(e) {
    return e
  }

  return groups
    .toString()
    .split('\n')
    .filter(function (group) {
      return group.length && group[0] != '#';
    })
    .reduce(function(map, group) {
      var fields = group.split(':');
      map[fields[0]] = map[fields[2]] = {
        name : fields[0],
        password : fields[1],
        id : fields[2],
        members : fields[3].split(',')
      };
      return map;
    }, {})
}

module.exports = {
  getUsers,
  getGroups
}
