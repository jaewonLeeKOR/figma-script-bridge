#!/usr/bin/env node
// 사용: node bridge.mjs serve            — 127.0.0.1:3899에서 플러그인과 연결
//       node bridge.mjs run <script.js> [outDir]  — 스크립트 실행, 결과 JSON 출력, PNG는 outDir에 저장
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const PORT = +process.env.FIGMA_BRIDGE_PORT || 3899;
const TOKEN_FILE = process.env.FIGMA_BRIDGE_TOKEN_FILE || path.join(os.homedir(), '.figma-script-bridge-token');
const [cmd, file, outDir = '.'] = process.argv.slice(2);

if (cmd === 'serve') {
  // ponytail: 잡 등록만 토큰으로 막는다. /next·/result는 플러그인 iframe(origin null)용이라 토큰 없음 — 로컬 전용 개발 도구 한정.
  const token = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
  const jobs = [], waiters = [], pending = new Map();
  const cors = { 'Access-Control-Allow-Origin': 'null' };
  const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => r(b)); });
  http.createServer(async (req, res) => {
    if (req.url === '/next') {
      const send = job => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(job)); };
      if (jobs.length) return send(jobs.shift());
      const w = { send }; waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); res.writeHead(204, cors); res.end(); } }, 25000);
      return;
    }
    if (req.url === '/result' && req.method === 'POST') {
      const r = JSON.parse(await body(req)); pending.get(r.id)?.(r); pending.delete(r.id);
      res.writeHead(204, cors); return res.end();
    }
    if (req.url === '/job' && req.method === 'POST') {
      if (req.headers['x-bridge-token'] !== token) { res.writeHead(403); return res.end(); }
      const job = { id: crypto.randomUUID(), code: await body(req) };
      pending.set(job.id, r => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r)); });
      const w = waiters.shift(); w ? w.send(job) : jobs.push(job);
      return;
    }
    res.writeHead(404); res.end();
  }).listen(PORT, '127.0.0.1', () => console.log(`figma-script-bridge on 127.0.0.1:${PORT}`));
} else if (cmd === 'run' && file) {
  const token = fs.readFileSync(TOKEN_FILE, 'utf8');
  const res = await fetch(`http://127.0.0.1:${PORT}/job`, { method: 'POST', headers: { 'x-bridge-token': token }, body: fs.readFileSync(file, 'utf8') });
  const r = await res.json();
  const saved = [];
  const dec = (v, key) => v && v.__png ? (fs.mkdirSync(outDir, { recursive: true }), fs.writeFileSync(path.join(outDir, `${key}.png`), Buffer.from(v.__png, 'base64')), saved.push(path.join(outDir, `${key}.png`)), `<png ${key}.png>`)
    : Array.isArray(v) ? v.map((x, i) => dec(x, `${key}-${i}`)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x, k)])) : v;
  console.log(JSON.stringify(r.ok ? { ok: true, value: dec(r.value, 'shot'), saved } : r, null, 1));
  process.exit(r.ok ? 0 : 1);
} else {
  console.log('usage: node bridge.mjs serve | run <script.js> [outDir]');
}
