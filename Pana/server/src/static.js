// Static file serving with path traversal guard.

import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function serveStatic(res, baseDir, relPath) {
  const target = path.normalize(path.join(baseDir, relPath));
  if (!target.startsWith(baseDir)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Cache-Control': 'no-store' }).end('not found');
      return;
    }
    // no-cache: browsers (and Cloudflare) check before every use, so a deploy reaches
    // phones at once. The ETag lets an unchanged file answer that check with a 304.
    const etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const headers = { ETag: etag, 'Cache-Control': 'no-cache' };
    const asked = res.req?.headers['if-none-match'];
    if (asked && asked.split(',').some(tag => tag.trim().replace(/^W\//, '') === etag)) {
      res.writeHead(304, headers).end();
      return;
    }
    res.writeHead(200, {
      ...headers,
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
    });
    fs.createReadStream(target).pipe(res);
  });
}
