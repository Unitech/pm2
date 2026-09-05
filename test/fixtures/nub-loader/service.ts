const { createServer } = require('node:http');

enum ContainerMode {
  Pm2 = 'pm2',
}

const sourceMapFrame = new Error('source map check').stack?.split('\n')[1]?.trim();

console.log(JSON.stringify({
  event: 'ready',
  mode: ContainerMode.Pm2,
  cwd: process.cwd(),
  node: process.versions.node,
  sourceMapFrame,
}));

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
