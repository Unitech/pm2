const http = require('http');

const port = 3000;

const app = http.createServer((_, res) => {
  res.writeHead(200);
  res.end('Hello!');
});

console.log('Starting app...');

process.on('SIGINT', (msg) => {
  console.log('Just got SIGINTed, but I dont care');
});

setTimeout(() => {
  app.listen(port, () => {
    console.log(`Listening on ${port}`);
    if (process.send) {
      process.send('ready');
    }
  });
}, 10000);
