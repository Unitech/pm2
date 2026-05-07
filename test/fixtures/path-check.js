console.log(__filename);
console.log(module.filename);
console.log(module.parent);
console.log(module.children);
console.log(__dirname);
// Output specific module properties that should be consistent between direct and PM2 execution
// Note: module.id and module.loaded differ between direct node and PM2 wrapped fork (expected)
console.log(JSON.stringify({
  path: module.path,
  filename: module.filename,
  paths: module.paths
}));
console.log(process.env.PWD);
console.log(require.main.filename);
console.log(require.main === module);
