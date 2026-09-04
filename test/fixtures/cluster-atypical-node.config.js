// Explicit cluster mode with a Node.js interpreter whose basename is not
// literally `node` (nodejs, node20, node.exe...). The interpreter path is
// injected by the e2e script through ATYPICAL_NODE.
module.exports = {
  apps: [{
    name: 'mjs-atypical',
    script: './esmodules/mjs/index.mjs',
    exec_mode: 'cluster',
    instances: 1,
    interpreter: process.env.ATYPICAL_NODE
  }]
};
