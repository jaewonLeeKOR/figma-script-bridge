// 서버 왕복 자기검증: 가짜 플러그인이 /next로 잡을 받고 /result로 돌려주면 run이 JSON과 PNG를 내놓는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tkb-'));
const env = { ...process.env, FIGMA_BRIDGE_PORT: '3998', FIGMA_BRIDGE_TOKEN_FILE: path.join(dir, 'token') };
const url = 'http://127.0.0.1:3998';

test('job round-trip, png decode, token required', async t => {
  const server = spawn('node', ['bridge.mjs', 'serve'], { env });
  t.after(() => server.kill());
  await new Promise(r => server.stdout.once('data', r));

  assert.equal((await fetch(url + '/ping')).status, 204);
  assert.equal((await fetch(url + '/job', { method: 'POST', body: 'return 1' })).status, 403);

  const script = path.join(dir, 's.js');
  fs.writeFileSync(script, 'return 1');
  const run = new Promise(r => execFile('node', ['bridge.mjs', 'run', script, dir], { env }, (e, out) => r({ code: e?.code ?? 0, out })));

  const job = await (await fetch(url + '/next')).json();
  assert.equal(job.code, 'return 1');
  await fetch(url + '/result', { method: 'POST', body: JSON.stringify({ id: job.id, ok: true, value: { n: 1, frame: { __png: Buffer.from('PNG').toString('base64') } } }) });

  const { code, out } = await run;
  assert.equal(code, 0);
  const r = JSON.parse(out);
  assert.equal(r.value.n, 1);
  assert.equal(r.value.frame, '<png frame.png>');
  assert.equal(fs.readFileSync(path.join(dir, 'frame.png'), 'utf8'), 'PNG');
});
