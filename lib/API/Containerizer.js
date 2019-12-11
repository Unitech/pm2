
var spawn   = require('child_process').spawn;
var exec    = require('child_process').exec;
var chalk   = require('chalk');
var util    = require('util');
var fmt     = require('../tools/fmt.js');
var fs      = require('fs');
var path    = require('path');
var cst     = require('../../constants.js');
var Promise = require('../tools/promise.min.js');

function pspawn(cmd) {
  return new Promise(function(resolve, reject) {
    var p_cmd = cmd.split(' ');

    var install_instance = spawn(p_cmd[0], p_cmd.splice(1, cmd.length), {
      stdio : 'inherit',
      env : process.env,
      shell : true
    });

    install_instance.on('close', function(code) {
      if (code != 0) {
        console.log(chalk.bold.red('Command failed'));
        return reject(new Error('Bad cmd return'));
      }
      return resolve();
    });

    install_instance.on('error', function (err) {
      return reject(err);
    });
  });
}

function checkDockerSetup() {
  return new Promise(function(resolve, reject) {
    exec("docker version -f '{{.Client.Version}}'", function(err, stdout, stderr) {
      if (err) {
        console.error(chalk.red.bold('[Docker access] Error while trying to use docker command'));
        if (err.message && err.message.indexOf('Cannot connect to the Docker') > -1) {
          console.log();
          console.log(chalk.blue.bold('[Solution] Setup Docker to be able to be used without sudo rights:'));
          console.log(chalk.bold('$ sudo groupadd docker'));
          console.log(chalk.bold('$ sudo usermod -aG docker $USER'));
          console.log(chalk.bold('Then LOGOUT and LOGIN your Linux session'));
          console.log('Read more: http://bit.ly/29JGdCE');
        }
        return reject(err);
      }
      return resolve();
    });
  });
}

/**
 * Switch Dockerfile mode
 * check test/programmatic/containerizer.mocha.js
 */
function parseAndSwitch(file_content, main_file, opts) {
  var lines = file_content.split('\n');
  var mode = opts.mode;

  lines[0] = 'FROM keymetrics/pm2:' + opts.node_version;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (['## DISTRIBUTION MODE', '## DEVELOPMENT MODE'].indexOf(line) > -1 ||
        i == lines.length - 1) {
      lines.splice(i, lines.length);
      lines[i] = '## ' + mode.toUpperCase() + ' MODE';
      lines[i + 1] = 'ENV NODE_ENV=' + (mode == 'distribution' ? 'production' : mode);

      if (mode == 'distribution') {
        lines[i + 2] = 'COPY . /var/app';
        lines[i + 3] = 'CMD ["pm2-docker", "' + main_file + '", "--env", "production"]';
      }
      if (mode == 'development') {
        lines[i + 2] = 'CMD ["pm2-dev", "' + main_file + '", "--env", "development"]';
      }
      break;
    }
  };
  lines = lines.join('\n');
  return lines;
};

/**
 * Replace ENV, COPY and CMD depending on the mode
 * @param {String} docker_filepath Dockerfile absolute path
 * @param {String} main_file       Main file to start in container
 * @param {String} mode            Mode to switch the Dockerfile
 */
function switchDockerFile(docker_filepath, main_file, opts) {
  return new Promise(function(resolve, reject) {
    var data  = fs.readFileSync(docker_filepath, 'utf8').toString();

    if (['distribution', 'development'].indexOf(opts.mode) == -1)
      return reject(new Error('Unknown mode'));

    var lines = parseAndSwitch(data, main_file, opts)
    fs.writeFile(docker_filepath, lines, function(err) {
      if (err) return reject(err);
      resolve({
        Dockerfile_path : docker_filepath,
        Dockerfile : lines,
        CMD : ''
      });
    })
  });
}

/**
 * Generate sample Dockerfile (lib/templates/Dockerfiles)
 * @param {String} docker_filepath Dockerfile absolute path
 * @param {String} main_file       Main file to start in container
 * @param {String} mode            Mode to switch the Dockerfile
 */
function generateDockerfile(docker_filepath, main_file, opts) {
  return new Promise(function(resolve, reject) {
    var tpl_file = path.join(cst.TEMPLATE_FOLDER, cst.DOCKERFILE_NODEJS);
    var template = fs.readFileSync(tpl_file, {encoding: 'utf8'});
    var CMD;

    template = parseAndSwitch(template, main_file, opts);

    fs.writeFile(docker_filepath, template, function(err) {
      if (err) return reject(err);
      resolve({
        Dockerfile_path : docker_filepath,
        Dockerfile : template,
        CMD : CMD
      });
    });
  });
}

function handleExit(CLI, opts, mode) {
  process.on('SIGINT', function() {
    CLI.disconnect();

    if (mode != 'distribution')
      return false;

    exec('docker ps -lq', function(err, stdout, stderr) {
      if (err) {
        console.error(err);
      }
      require('vizion').analyze({folder : process.cwd()}, function recur_path(err, meta){
        if (!err && meta.revision) {
          var commit_id = util.format('#%s(%s) %s',
                                      meta.branch,
                                      meta.revision.slice(0, 5),
                                      meta.comment);

          console.log(chalk.bold.magenta('$ docker commit -m "%s" %s %s'),
                      commit_id,
                      stdout.replace('\n', ''),
                      opts.imageName);
        }
        else
          console.log(chalk.bold.magenta('$ docker commit %s %s'), stdout.replace('\n', ''), opts.imageName);

        console.log(chalk.bold.magenta('$ docker push %s'), opts.imageName);
      });
    });
  });
}

module.exports = function(CLI) {
  CLI.prototype.generateDockerfile = function(script, opts) {
    var docker_filepath = path.join(process.cwd(), 'Dockerfile');
    var that = this;

    fs.stat(docker_filepath, function(err, stat) {
      if (err || opts.force == true) {
        generateDockerfile(docker_filepath, script, {
          mode : 'development'
        })
          .then(function() {
            console.log(chalk.bold('New Dockerfile generated in current folder'));
            console.log(chalk.bold('You can now run\n$ pm2 docker:dev <file|config>'));
            return that.exitCli(cst.SUCCESS_EXIT);
          });
        return false;
      }
      console.log(chalk.red.bold('Dockerfile already exists in this folder, use --force if you want to replace it'));
      that.exitCli(cst.ERROR_EXIT);
    });
  };

  CLI.prototype.dockerMode = function(script, opts, mode) {
    var promptly = require('promptly');
    var self = this;
    handleExit(self, opts, mode);

    if (mode == 'distribution' && !opts.imageName) {
      console.error(chalk.bold.red('--image-name [name] option is missing'));
      return self.exitCli(cst.ERROR_EXIT);
    }

    var template;
    var app_path, main_script;
    var image_name;
    var node_version = opts.nodeVersion ? opts.nodeVersion.split('.')[0] : 'latest';

    image_name   = opts.imageName || require('crypto').randomBytes(6).toString('hex');

    if (script.indexOf('/') > -1) {
      app_path  = path.join(process.cwd(), path.dirname(script));
      main_script = path.basename(script);
    }
    else {
      app_path  = process.cwd();
      main_script = script;
    }

    checkDockerSetup()
      .then(function() {
        /////////////////////////
        // Generate Dockerfile //
        /////////////////////////
        return new Promise(function(resolve, reject) {
          var docker_filepath = path.join(process.cwd(), 'Dockerfile');

          fs.stat(docker_filepath, function(err, stat) {
            if (err) {
              // Dockerfile does not exist, generate one
              // console.log(chalk.blue.bold('Generating new Dockerfile'));
              if (opts.force == true) {
                return resolve(generateDockerfile(docker_filepath, main_script, {
                  node_version : node_version,
                  mode : mode
                }));
              }
              if (opts.dockerdaemon)
                return resolve(generateDockerfile(docker_filepath, main_script, {
                    node_version : node_version,
                    mode : mode
                  }));
              promptly.prompt('No Dockerfile in current directory, ok to generate a new one? (y/n)', function(err, value) {
                if (value == 'y')
                  return resolve(generateDockerfile(docker_filepath, main_script, {
                    node_version : node_version,
                    mode : mode
                  }));
                else
                  return self.exitCli(cst.SUCCESS_EXIT);
              });
              return false;
            }
            return resolve(switchDockerFile(docker_filepath, main_script, {
              node_version : node_version,
              mode : mode
            }));
          });
        });
      })
      .then(function(_template) {
        template = _template;
        return Promise.resolve();
      })
      .then(function() {
        //////////////////
        // Docker build //
        //////////////////

        var docker_build = util.format('docker build -t %s -f %s',
                                       image_name,
                                       template.Dockerfile_path);

        if (opts.fresh == true)
          docker_build += ' --no-cache';
        docker_build += ' .';

        console.log();
        fmt.sep();
        fmt.title('Building Boot System');
        fmt.field('Type', chalk.cyan.bold('Docker'));
        fmt.field('Mode', mode);
        fmt.field('Image name', image_name);
        fmt.field('Docker build command', docker_build);
        fmt.field('Dockerfile path', template.Dockerfile_path);
        fmt.sep();

        return pspawn(docker_build);
      })
      .then(function() {
        ////////////////
        // Docker run //
        ////////////////

        var docker_run = 'docker run --net host';

        if (opts.dockerdaemon == true)
          docker_run += ' -d';
        if (mode != 'distribution')
          docker_run += util.format(' -v %s:/var/app -v /var/app/node_modules', app_path);
        docker_run += ' ' + image_name;
        var dockerfile_parsed = template.Dockerfile.split('\n');
        var base_image = dockerfile_parsed[0];
        var run_cmd = dockerfile_parsed[dockerfile_parsed.length - 1];

        console.log();
        fmt.sep();
        fmt.title('Booting');
        fmt.field('Type', chalk.cyan.bold('Docker'));
        fmt.field('Mode', mode);
        fmt.field('Base Image', base_image);
        fmt.field('Image Name', image_name);
        fmt.field('Docker Command', docker_run);
        fmt.field('RUN Command', run_cmd);
        fmt.field('CWD', app_path);
        fmt.sep();
        return pspawn(docker_run);
      })
      .then(function() {
        console.log(chalk.blue.bold('>>> Leaving Docker instance uuid=%s'), image_name);
        self.disconnect();
        return Promise.resolve();
      })
      .catch(function(err) {
        console.log();
        console.log(chalk.grey('Raw error=', err.message));
        self.disconnect();
      });

  };

};

module.exports.generateDockerfile = generateDockerfile;
module.exports.parseAndSwitch     = parseAndSwitch;
module.exports.switchDockerFile   = switchDockerFile;
