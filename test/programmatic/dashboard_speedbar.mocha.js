/**
 * The host-metrics line from `pm2 ls` also renders in `pm2 monit`.
 * Empty snapshots stay blank so the bar does not reserve a row when
 * pm2:sysmonit is off. Virtual interfaces are dropped, same as pm2 ls.
 */

process.env.NODE_ENV = 'test';

var Dashboard = require('../../lib/API/Dashboard');

describe('Dashboard host metrics speedbar', function() {

  function metric(value, unit) {
    return { value: value, unit: unit || '' };
  }

  it('should stay blank without a snapshot or a CPU reading', function() {
    Dashboard.buildSpeedbarLine(null).should.eql('');
    Dashboard.buildSpeedbarLine({}).should.eql('');
    Dashboard.buildSpeedbarLine({ 'RAM Usage': metric(10, '%') }).should.eql('');
  });

  it('should render cpu and ram with the same thresholds as pm2 ls', function() {
    var line = Dashboard.buildSpeedbarLine({
      'CPU Usage': metric(12, '%'),
      'CPU Temperature': metric(-1, '°C'),
      'RAM Usage': metric(91, '%')
    });
    line.should.match(/host metrics/);
    line.should.match(/\{green-fg\}12%/);
    line.should.match(/\{red-fg\}\{bold\}91%\{\/\}/);
    line.should.not.match(/º/);
  });

  it('should skip virtual interfaces and show a busy physical one in kb/s', function() {
    var line = Dashboard.buildSpeedbarLine({
      'CPU Usage': metric(5, '%'),
      'net:rx_5:lo0': metric(40, 'mb/s'),
      'net:tx_5:lo0': metric(40, 'mb/s'),
      'net:rx_5:en0': metric(0.5, 'mb/s'),
      'net:tx_5:en0': metric(0, 'mb/s')
    });
    line.should.not.match(/lo0/);
    line.should.match(/en0/);
    line.should.match(/512kb\/s/);
  });

  it('should mention a nearly full mount and shorten a long path', function() {
    var line = Dashboard.buildSpeedbarLine({
      'CPU Usage': metric(5, '%'),
      'Disk Reads': metric(0, 'mb/s'),
      'Disk Writes': metric(0, 'mb/s'),
      'fs:use:/System/Volumes/Data/Users/butch/very/long': metric(95, '%')
    });
    line.should.match(/disk/);
    line.should.match(/95%/);
    line.should.match(/…\//);
    line.should.not.match(/System\/Volumes/);
  });
});
