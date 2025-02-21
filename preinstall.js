const fs = require('fs');
const path = require('path');

// Determine platform
const isWindows = process.platform === 'win32';

if (!isWindows)
  process.exit(0)

const sourceFile = 'bin/pm2-windows';
const destinationFile = 'bin/pm2';

// Resolve file paths
const sourcePath = path.resolve(__dirname, sourceFile);
const destinationPath = path.resolve(__dirname, destinationFile);

// Copy the appropriate file based on the platform
fs.copyFile(sourcePath, destinationPath, (err) => {
  if (err) {
    console.error(`Error copying file from ${sourcePath} to ${destinationPath}:`, err);
    process.exit(1);
  }
  console.log(`Successfully copied ${sourceFile} to ${destinationFile}`);
});
