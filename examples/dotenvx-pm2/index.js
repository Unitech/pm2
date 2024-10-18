import http from 'http';

const {
  PORT,
  SH,
  DE,
  PM,
  SH_DE,
  SH_PM,
  DE_PM,
  SH_DE_PM,
} = process.env;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end(JSON.stringify({
    SH,
    DE,
    PM,
    SH_DE,
    SH_PM,
    DE_PM,
    SH_DE_PM,
  }, null, 2));
}).listen(PORT, '0.0.0.0', () => {
  console.log(`App listening on port ${PORT}`);
});
