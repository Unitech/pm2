/**
 * Copyright 2013 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var fs = require('fs');
var http = require('http');
var url = require('url');
var path = require('path');
var debug = require('debug')('pm2:serve');
var probe = require('pmx').probe();

/**
 * list of supported content types.
 */
var contentTypes = {
  '3gp': 'video/3gpp',
  'a': 'application/octet-stream',
  'ai': 'application/postscript',
  'aif': 'audio/x-aiff',
  'aiff': 'audio/x-aiff',
  'asc': 'application/pgp-signature',
  'asf': 'video/x-ms-asf',
  'asm': 'text/x-asm',
  'asx': 'video/x-ms-asf',
  'atom': 'application/atom+xml',
  'au': 'audio/basic',
  'avi': 'video/x-msvideo',
  'bat': 'application/x-msdownload',
  'bin': 'application/octet-stream',
  'bmp': 'image/bmp',
  'bz2': 'application/x-bzip2',
  'c': 'text/x-c',
  'cab': 'application/vnd.ms-cab-compressed',
  'cc': 'text/x-c',
  'chm': 'application/vnd.ms-htmlhelp',
  'class': 'application/octet-stream',
  'com': 'application/x-msdownload',
  'conf': 'text/plain',
  'cpp': 'text/x-c',
  'crt': 'application/x-x509-ca-cert',
  'css': 'text/css',
  'csv': 'text/csv',
  'cxx': 'text/x-c',
  'deb': 'application/x-debian-package',
  'der': 'application/x-x509-ca-cert',
  'diff': 'text/x-diff',
  'djv': 'image/vnd.djvu',
  'djvu': 'image/vnd.djvu',
  'dll': 'application/x-msdownload',
  'dmg': 'application/octet-stream',
  'doc': 'application/msword',
  'dot': 'application/msword',
  'dtd': 'application/xml-dtd',
  'dvi': 'application/x-dvi',
  'ear': 'application/java-archive',
  'eml': 'message/rfc822',
  'eps': 'application/postscript',
  'exe': 'application/x-msdownload',
  'f': 'text/x-fortran',
  'f77': 'text/x-fortran',
  'f90': 'text/x-fortran',
  'flv': 'video/x-flv',
  'for': 'text/x-fortran',
  'gem': 'application/octet-stream',
  'gemspec': 'text/x-script.ruby',
  'gif': 'image/gif',
  'gz': 'application/x-gzip',
  'h': 'text/x-c',
  'hh': 'text/x-c',
  'htm': 'text/html',
  'html': 'text/html',
  'ico': 'image/vnd.microsoft.icon',
  'ics': 'text/calendar',
  'ifb': 'text/calendar',
  'iso': 'application/octet-stream',
  'jar': 'application/java-archive',
  'java': 'text/x-java-source',
  'jnlp': 'application/x-java-jnlp-file',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'application/javascript',
  'json': 'application/json',
  'log': 'text/plain',
  'm3u': 'audio/x-mpegurl',
  'm4v': 'video/mp4',
  'man': 'text/troff',
  'mathml': 'application/mathml+xml',
  'mbox': 'application/mbox',
  'mdoc': 'text/troff',
  'me': 'text/troff',
  'mid': 'audio/midi',
  'midi': 'audio/midi',
  'mime': 'message/rfc822',
  'mml': 'application/mathml+xml',
  'mng': 'video/x-mng',
  'mov': 'video/quicktime',
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',
  'mp4v': 'video/mp4',
  'mpeg': 'video/mpeg',
  'mpg': 'video/mpeg',
  'ms': 'text/troff',
  'msi': 'application/x-msdownload',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'odt': 'application/vnd.oasis.opendocument.text',
  'ogg': 'application/ogg',
  'p': 'text/x-pascal',
  'pas': 'text/x-pascal',
  'pbm': 'image/x-portable-bitmap',
  'pdf': 'application/pdf',
  'pem': 'application/x-x509-ca-cert',
  'pgm': 'image/x-portable-graymap',
  'pgp': 'application/pgp-encrypted',
  'pkg': 'application/octet-stream',
  'pl': 'text/x-script.perl',
  'pm': 'text/x-script.perl-module',
  'png': 'image/png',
  'pnm': 'image/x-portable-anymap',
  'ppm': 'image/x-portable-pixmap',
  'pps': 'application/vnd.ms-powerpoint',
  'ppt': 'application/vnd.ms-powerpoint',
  'ps': 'application/postscript',
  'psd': 'image/vnd.adobe.photoshop',
  'py': 'text/x-script.python',
  'qt': 'video/quicktime',
  'ra': 'audio/x-pn-realaudio',
  'rake': 'text/x-script.ruby',
  'ram': 'audio/x-pn-realaudio',
  'rar': 'application/x-rar-compressed',
  'rb': 'text/x-script.ruby',
  'rdf': 'application/rdf+xml',
  'roff': 'text/troff',
  'rpm': 'application/x-redhat-package-manager',
  'rss': 'application/rss+xml',
  'rtf': 'application/rtf',
  'ru': 'text/x-script.ruby',
  's': 'text/x-asm',
  'sgm': 'text/sgml',
  'sgml': 'text/sgml',
  'sh': 'application/x-sh',
  'sig': 'application/pgp-signature',
  'snd': 'audio/basic',
  'so': 'application/octet-stream',
  'svg': 'image/svg+xml',
  'svgz': 'image/svg+xml',
  'swf': 'application/x-shockwave-flash',
  't': 'text/troff',
  'tar': 'application/x-tar',
  'tbz': 'application/x-bzip-compressed-tar',
  'tcl': 'application/x-tcl',
  'tex': 'application/x-tex',
  'texi': 'application/x-texinfo',
  'texinfo': 'application/x-texinfo',
  'text': 'text/plain',
  'tif': 'image/tiff',
  'tiff': 'image/tiff',
  'torrent': 'application/x-bittorrent',
  'tr': 'text/troff',
  'txt': 'text/plain',
  'vcf': 'text/x-vcard',
  'vcs': 'text/x-vcalendar',
  'vrml': 'model/vrml',
  'war': 'application/java-archive',
  'wav': 'audio/x-wav',
  'wma': 'audio/x-ms-wma',
  'wmv': 'video/x-ms-wmv',
  'wmx': 'video/x-ms-wmx',
  'wrl': 'model/vrml',
  'wsdl': 'application/wsdl+xml',
  'xbm': 'image/x-xbitmap',
  'xhtml': 'application/xhtml+xml',
  'xls': 'application/vnd.ms-excel',
  'xml': 'application/xml',
  'xpm': 'image/x-xpixmap',
  'xsl': 'application/xml',
  'xslt': 'application/xslt+xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  'zip': 'application/zip',
  'woff': 'application/font-woff',
  'woff2': 'application/font-woff',
  'otf': 'application/font-sfnt',
  'otc': 'application/font-sfnt',
  'ttf': 'application/font-sfnt'
};

var errorMeter = probe.meter({
  name      : '404/sec',
  samples   : 1,
  timeframe : 60
});

var options = {
  port: process.env.PM2_SERVE_PORT || process.argv[3] || 8080,
  path: path.resolve(process.env.PM2_SERVE_PATH || process.argv[2] || '.')
};

// start an HTTP server
http.createServer(function (request, response) {
  var file = url.parse(request.url).pathname;

  if (file === '/' || file === '') {
    file = '/index.html';
  }
  var filePath = path.resolve(options.path + file);

  // since we call filesystem directly so we need to verify that the
  // url doesn't go outside the serve path
  if (filePath.indexOf(options.path) !== 0) {
    response.writeHead(403, { 'Content-Type': 'text/html' });
    return response.end('403 Forbidden');
  }

  var contentType = contentTypes[filePath.split('.').pop().toLowerCase()] || 'text/plain';

  fs.readFile(filePath, function (error, content) {
    if (error) {
      console.error('[%s] Error while serving %s with content-type %s : %s',
                    Date.now(), filePath, contentType, error.message || error);
      errorMeter.mark();
      if (error.code === 'ENOENT') {
        fs.readFile(options.path + '/404.html', function (err, content) {
          content = err ? '404 Not Found' : content;
          response.writeHead(404, { 'Content-Type': 'text/html' });
          response.end(content, 'utf-8');
        });
      } else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
      debug('[%s] Serving %s with content-type %s', Date.now(), filePath, contentType);
    }
  });
}).listen(options.port, function (err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Exposing %s directory on port %d', options.path, options.port);
});
