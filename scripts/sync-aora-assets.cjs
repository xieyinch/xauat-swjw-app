const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'src', 'vendor', 'aora');
const destination = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'aora');

if (!fs.existsSync(source)) {
  throw new Error(`Aora asset source is missing: ${source}`);
}

fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true, force: true });
console.log(`Synced Aora assets to ${destination}`);
