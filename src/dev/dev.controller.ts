import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { createHash, createHmac, randomUUID } from 'crypto';
import { SkipThrottle } from '@nestjs/throttler';

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
async function generate() {
  const errEl = document.getElementById('error');
  errEl.style.display = 'none';
  try {
    const payload = {
      secret: document.getElementById('secret').value.trim(),
      clientId: document.getElementById('clientId').value.trim(),
      keyId: document.getElementById('keyId').value.trim(),
      method: document.getElementById('method').value,
      path: document.getElementById('path').value.trim(),
      body: document.getElementById('body').value,
    };

    const res = await fetch('/dev/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Sign failed: ' + res.status + ' ' + (await res.text()));
    const headers = await res.json();

    const container = document.getElementById('headers');
    container.innerHTML = headers.map(function (h) {
      const nameEl = document.createElement('span');
      nameEl.className = 'header-name';
      nameEl.textContent = h[0];
      const valEl = document.createElement('span');
      valEl.className = 'header-value';
      valEl.id = 'val-' + h[0];
      valEl.textContent = h[1];
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = ' Copy ';
      btn.onclick = function() { copyVal(h[0], this); };
      const row = document.createElement('div');
      row.className = 'header-row';
      row.appendChild(nameEl);
      row.appendChild(valEl);
      row.appendChild(btn);
      return row;
    }).forEach(function(el) { container.appendChild(el); });

    document.getElementById('result').style.display = 'block';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function copyVal(name, btn) {
  const val = document.getElementById('val-' + name).textContent;
  const done = function () {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () { btn.textContent = ' Copy '; btn.classList.remove('copied'); }, 1500);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(val).then(done).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
  function fallbackCopy() {
    const ta = document.createElement('textarea');
    ta.value = val;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) {}
    document.body.removeChild(ta);
  }
}
</script>
</body>
</html>`;

interface SignBody {
  secret: string;
  clientId: string;
  keyId: string;
  method: string;
  path: string;
  body: string;
}

@SkipThrottle()
@Controller('dev')
export class DevController {
  @Get('signer')
  getSigner(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(HTML);
  }

  @Post('sign')
  sign(@Body() input: SignBody) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = randomUUID();
    const bodyHash = createHash('sha256')
      .update(input.body ?? '')
      .digest('hex');
    const canonical = [
      input.method.toUpperCase(),
      input.path,
      timestamp,
      nonce,
      bodyHash,
    ].join('\n');
    const signature = createHmac('sha256', input.secret)
      .update(canonical)
      .digest('hex');
    return [
      ['X-Client-Id', input.clientId],
      ['X-Key-Id', input.keyId],
      ['X-Timestamp', timestamp],
      ['X-Nonce', nonce],
      ['X-Signature-Version', 'v1'],
      ['X-Signature', signature],
    ];
  }
}
