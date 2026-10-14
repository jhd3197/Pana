// Syntax check for every .js file in server/, web/ and games/.
// Run: npm run check

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

function collectJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') collectJs(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = [
  ...collectJs(path.join(config.paths.root, 'server', 'src')),
  ...collectJs(config.paths.web),
  ...collectJs(config.paths.games),
];

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`ok      ${path.relative(config.paths.root, file)}`);
  } catch (err) {
    failed++;
    console.log(`FAIL    ${path.relative(config.paths.root, file)}`);
    console.log(String(err.stderr).trim());
  }
}

if (failed) {
  console.log(`\n${failed} file(s) failed`);
  process.exit(1);
}
console.log(`\n${files.length} files checked, all good`);
