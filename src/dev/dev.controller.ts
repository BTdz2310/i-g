import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

const HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Partner Auth Signer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; width: 100%; max-width: 680px; }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; color: #fff; }
    .subtitle { font-size: 13px; color: #666; margin-bottom: 24px; }
    label { display: block; font-size: 12px; color: #888; margin-bottom: 6px; margin-top: 16px; text-transform: uppercase; letter-spacing: .5px; }
    input, select, textarea { width: 100%; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; color: #e0e0e0; padding: 8px 12px; font-size: 14px; font-family: inherit; outline: none; }
    input:focus, select:focus, textarea:focus { border-color: #7c3aed; }
    textarea { resize: vertical; font-family: 'Menlo', 'Monaco', monospace; font-size: 13px; }
    .row { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
    button { margin-top: 24px; width: 100%; padding: 10px; background: #7c3aed; border: none; border-radius: 6px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
    button:hover { background: #6d28d9; }
    .result { margin-top: 24px; display: none; }
    .result h2 { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 12px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; }
    .header-name { font-size: 12px; color: #7c3aed; font-family: monospace; min-width: 180px; }
    .header-value { font-size: 12px; font-family: monospace; color: #e0e0e0; word-break: break-all; flex: 1; margin: 0 12px; }
    .copy-btn { font-size: 11px; background: #2a2a2a; border: none; color: #aaa; padding: 3px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
    .copy-btn:hover { background: #3a3a3a; color: #fff; }
    .copy-btn.copied { color: #4ade80; }
    .error { margin-top: 16px; padding: 10px 14px; background: #2d1111; border: 1px solid #7f1d1d; border-radius: 6px; font-size: 13px; color: #f87171; display: none; }
    .note { margin-top: 16px; font-size: 12px; color: #555; line-height: 1.6; }
  </style>
</head>
<body>
<div class="card">
  <h1>Partner Auth Signer</h1>
  <p class="subtitle">Tính HMAC headers để test trên Scalar — dev only</p>

  <label>Secret</label>
  <input id="secret" type="password" value="9e4e91c78df3b1c36b3e212484c8df7d6e7a953a10e062a2107311eaf7263675">

  <label>Client ID &amp; Key ID</label>
  <div class="row">
    <input id="clientId" value="partner-demo-001">
    <input id="keyId" value="2d0b0829-ff48-42c1-b9c0-211ceaa5582b">
  </div>

  <label>Method &amp; Path</label>
  <div class="row">
    <select id="method">
      <option>POST</option>
      <option>GET</option>
      <option>PATCH</option>
    </select>
    <input id="path" value="/api/pvi/catalog">
  </div>

  <label>Request Body (paste y hệt body sẽ gửi)</label>
  <textarea id="body" rows="6">{
  "ten_dmuc": "LOAIXEMOTOR",
  "parent_value": "1",
  "giatri_chon": ""
}</textarea>

  <button onclick="generate()">Generate Headers</button>
  <div class="error" id="error"></div>

  <div class="result" id="result">
    <h2>Headers — copy vào Scalar</h2>
    <div id="headers"></div>
    <p class="note">Timestamp valid 5 phút. Nonce dùng 1 lần. Bấm Generate lại nếu hết hạn.</p>
  </div>
</div>

<script>
async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data) {
  const buf = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function uuid() {
  return crypto.randomUUID();
}

async function generate() {
  const errEl = document.getElementById('error');
  errEl.style.display = 'none';
  try {
    const secret = document.getElementById('secret').value.trim();
    const clientId = document.getElementById('clientId').value.trim();
    const keyId = document.getElementById('keyId').value.trim();
    const method = document.getElementById('method').value;
    const path = document.getElementById('path').value.trim();
    const body = document.getElementById('body').value;

    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = uuid();
    const bodyHash = await sha256(body);
    const canonical = [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\\n');
    const signature = await hmacSha256(secret, canonical);

    const headers = [
      ['X-Client-Id', clientId],
      ['X-Key-Id', keyId],
      ['X-Timestamp', timestamp],
      ['X-Nonce', nonce],
      ['X-Signature-Version', 'v1'],
      ['X-Signature', signature],
    ];

    const container = document.getElementById('headers');
    container.innerHTML = headers.map(([name, value]) => \`
      <div class="header-row">
        <span class="header-name">\${name}</span>
        <span class="header-value" id="val-\${name}">\${value}</span>
        <button class="copy-btn" onclick="copyVal('\${name}', this)">&nbsp;Copy&nbsp;</button>
      </div>
    \`).join('');

    document.getElementById('result').style.display = 'block';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function copyVal(name, btn) {
  const val = document.getElementById('val-' + name).textContent;
  navigator.clipboard.writeText(val).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = ' Copy '; btn.classList.remove('copied'); }, 1500);
  });
}
</script>
</body>
</html>`;

@Controller('dev')
export class DevController {
  @Get('signer')
  getSigner(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(HTML);
  }
}
