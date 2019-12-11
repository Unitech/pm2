const http = require('http');

process.on('SIGINT', (msg) => {
  console.log('Just got SIGINTed, but I dont care');
  process.exit(0);
});

const port = 3000;

const app = http.createServer((_, res) => {
  res.writeHead(200);
  res.end('Hello!');
});

setTimeout(() => {
  app.listen(port, () => {
    console.log(`Listening on ${port}`);
    if (process.send) {
      process.send('ready');
    }
  });
}, 10000);
