import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequestHandler } from '../src/app.js';

test('/g/<game> without a slash redirects to /g/<game>/ so relative game modules resolve', async () => {
  const server = http.createServer(createRequestHandler(Date.now(), {}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const get = path => new Promise((resolve, reject) => http.get({ port, host: '127.0.0.1', path }, res => { res.resume(); resolve(res); }).on('error', reject));
  try {
    const slashless = await get('/g/capis?debug');
    assert.equal(slashless.statusCode, 301);
    assert.equal(slashless.headers.location, '/g/capis/?debug');
    assert.equal((await get('/g/capis/')).statusCode, 200);
    assert.equal((await get('/g/nope')).statusCode, 404);
  } finally { server.close(); }
});
