
var Helper = {};

Helper.deployHelp = function() {
  console.log('');
  console.log('-----> Helper: Deployment with PM2');
  console.log('');
  console.log('  Generate a sample ecosystem.json with the command');
  console.log('  $ pm2 ecosystem');
  console.log('  Then edit the file depending on your needs');
  console.log('');
  console.log('  Commands:');
  console.log('    setup                run remote setup commands');
  console.log('    update               update deploy to the latest release');
  console.log('    revert [n]           revert to [n]th last deployment or 1');
  console.log('    curr[ent]            output current release commit');
  console.log('    prev[ious]           output previous release commit');
  console.log('    exec|run <cmd>       execute the given <cmd>');
  console.log('    list                 list previous deploy commits');
  console.log('    [ref]                deploy to [ref], the "ref" setting, or latest tag');
  console.log('');
  console.log('');
  console.log('  Basic Examples:');
  console.log('');
  console.log('    First initialize remote production host:');
  console.log('    $ pm2 deploy ecosystem.json production setup');
  console.log('');
  console.log('    Then deploy new code:');
  console.log('    $ pm2 deploy ecosystem.json production');
  console.log('');
  console.log('    If I want to revert to the previous commit:');
  console.log('    $ pm2 deploy ecosystem.json production revert 1');
  console.log('');
  console.log('    Execute a command on remote server:');
  console.log('    $ pm2 deploy ecosystem.json production exec "pm2 restart all"');
  console.log('');
  console.log('    PM2 will look by default to the ecosystem.json file so you dont need to give the file name:');
  console.log('    $ pm2 deploy production');
  console.log('    Else you have to tell PM2 the name of your ecosystem file');
  console.log('');
  console.log('    More examples in https://github.com/Unitech/pm2');
  console.log('');
};

module.exports = Helper;
