
var Containerizer = require('../../lib/API/Containerizer.js');
var path          = require('path');
var fs            = require('fs');
var should        = require('should');
var Plan          = require('../helpers/plan.js');

describe('Containerizer unit tests', function() {
  var fixture_path = path.join(__dirname, '../fixtures/containerizer');
  var Dockerfile = path.join(fixture_path, 'Dockerfile');

  var res_lines_dev = ['## DEVELOPMENT MODE',
                       'ENV NODE_ENV=development',
                       'CMD ["pm2-dev", "index.js", "--env", "development"]'];

  var res_lines_prod = ['## DISTRIBUTION MODE',
                        'ENV NODE_ENV=production',
                        'COPY . /var/app',
                        'CMD ["pm2-docker", "index.js", "--env", "production"]'];

  after(function(done) {
    fs.unlink(Dockerfile, done);
  });

  it('should have every relative require resolvable (lazy requires included)', function() {
    // dockerMode() requires lazily inside the function body, so a bad path
    // only crashes at invocation (`pm2 start --container`), not at load
    var source = fs.readFileSync(path.join(__dirname, '../../lib/API/Containerizer.js'), 'utf8');
    var relative_requires = [];
    var re = /require\(['"](\.[^'"]+)['"]\)/g;
    var match;
    while ((match = re.exec(source)) !== null)
      relative_requires.push(match[1]);

    should(relative_requires.length).be.above(0);
    var unresolved = relative_requires.filter(function(req) {
      try {
        require.resolve(path.join(__dirname, '../../lib/API', req));
        return false;
      } catch (e) {
        return true;
      }
    });
    should(unresolved).eql([]);
  });

  it('should generate a dockerfile', function() {
    var has_meta = false;

    return Containerizer.generateDockerfile(Dockerfile, 'index.js', {
      mode : 'development'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);

        var lines = meta.Dockerfile.split('\n');
        lines.forEach(function(line, i) {
          if (line == '## DEVELOPMENT MODE')  {
            has_meta = true;
            should(lines[i]).eql(res_lines_dev[0]);
            should(lines[i + 1]).eql(res_lines_dev[1]);
            should(lines[i + 2]).eql(res_lines_dev[2]);
          }
        });

        should(has_meta).be.true();
      });
  });

  it('should switch dockerfile to distribution', function() {
    return Containerizer.switchDockerFile(Dockerfile, 'index.js', {
      mode : 'distribution'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);

        var lines = meta.Dockerfile.split('\n')
        lines.forEach(function(line, i) {
          if (line == '## DISTRIBUTION MODE')  {
            should(lines[i]).eql(res_lines_prod[0]);
            should(lines[i + 1]).eql(res_lines_prod[1]);
            should(lines[i + 2]).eql(res_lines_prod[2]);
            should(lines[i + 3]).eql(res_lines_prod[3]);
          }
        });
      });
  });

  it('should switch dockerfile to distribution (no touching it)', function() {
    return Containerizer.switchDockerFile(Dockerfile, 'index.js', {
      mode : 'distribution'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);
        var lines = meta.Dockerfile.split('\n');
        lines.forEach(function(line, i) {
          if (line == '## DISTRIBUTION MODE')  {
            should(lines[i]).eql(res_lines_prod[0]);
            should(lines[i + 1]).eql(res_lines_prod[1]);
            should(lines[i + 2]).eql(res_lines_prod[2]);
            should(lines[i + 3]).eql(res_lines_prod[3]);
          }
        });
      });
  });

  it('should switch dockerfile to development', function() {
    return Containerizer.switchDockerFile(Dockerfile, 'index.js', {
      mode : 'development'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);

        var lines = meta.Dockerfile.split('\n');
        lines.forEach(function(line, i) {
          if (line == '## DEVELOPMENT MODE')  {
            should(lines[i]).eql(res_lines_dev[0]);
            should(lines[i + 1]).eql(res_lines_dev[1]);
            should(lines[i + 2]).eql(res_lines_dev[2]);
          }
        });
      });
  });

  it('should switch dockerfile to development (no touching it)', function() {
    return Containerizer.switchDockerFile(Dockerfile, 'index.js', {
      mode : 'development'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);

        var lines = meta.Dockerfile.split('\n');
        lines.forEach(function(line, i) {
          if (line == '## DEVELOPMENT MODE')  {
            should(lines[i]).eql(res_lines_dev[0]);
            should(lines[i + 1]).eql(res_lines_dev[1]);
            should(lines[i + 2]).eql(res_lines_dev[2]);
          }
        });
      });
  });

  it('should switch dockerfile to distribution', function() {
    return Containerizer.switchDockerFile(Dockerfile, 'index.js', {
      mode : 'distribution'
    })
      .then(function(meta) {
        meta.Dockerfile_path.should.eql(Dockerfile);
        fs.statSync(Dockerfile);

        var lines = meta.Dockerfile.split('\n')
        lines.forEach(function(line, i) {
          if (line == '## DISTRIBUTION MODE')  {
            should(lines[i]).eql(res_lines_prod[0]);
            should(lines[i + 1]).eql(res_lines_prod[1]);
            should(lines[i + 2]).eql(res_lines_prod[2]);
            should(lines[i + 3]).eql(res_lines_prod[3]);
          }
        });
      });
  });

});
