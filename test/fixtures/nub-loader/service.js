const { createServer } = require('node:http');

const server = createServer((_request, response) => {
  response.end('ok');
});

let shuttingDown = false;

process.on('SIGINT', () => {
  if (shuttingDown)
    return;
  shuttingDown = true;
  console.log(JSON.stringify({ event: 'shutdown', pid: process.pid }));
  process.disconnect?.();
  server.close();
});

server.listen(Number(process.env.PORT), () => process.send?.('ready'));
