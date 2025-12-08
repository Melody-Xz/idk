const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Helpers
const toBool = v => typeof v !== 'undefined' && ['1','true','yes','si','sí'].includes(String(v).toLowerCase());
const withTimeout = (ms = 20000) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(t) };
};

// --- Proveedor: Thum.io ---
// Doc habitual: https://image.thum.io/get/<opciones>/<URL>
async function streamFromThum(pageUrl, res, { full, width }) {
  const base = 'https://image.thum.io/get/';
  const parts = [];
  if (full) parts.push('fullpage');
  if (width && Number(width)) parts.push(`width/${Number(width)}`);
  const thumUrl = base + (parts.length ? parts.join('/') + '/' : '') + encodeURIComponent(pageUrl);

  const { signal, clear } = withTimeout(20000);
  const r = await fetch(thumUrl, { signal });
  clear();

  const ct = r.headers.get('content-type') || '';
  if (!r.ok || !ct.startsWith('image')) {
    throw new Error(`Thum.io failed: status=${r.status} type=${ct}`);
  }

  res.setHeader('Content-Type', ct);
  if (r.headers.get('cache-control')) res.setHeader('Cache-Control', r.headers.get('cache-control'));
  r.body.pipe(res);
}

// --- Proveedor: Microlink ---
// 1) Pide JSON con screenshot=true
// 2) Toma data.screenshot.url y la streamea
async function streamFromMicrolink(pageUrl, res, { full, width }) {
  // Microlink no obliga ancho, pero podemos pasar 'screenshot' options vía 'embed' si hiciera falta.
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}&screenshot=true&meta=false`;
  const { signal, clear } = withTimeout(20000);
  const meta = await fetch(apiUrl, { signal });
  clear();

  if (!meta.ok) throw new Error(`Microlink meta failed: ${meta.status}`);
  const json = await meta.json();
  const shotUrl = json?.data?.screenshot?.url;
  if (!shotUrl) throw new Error('Microlink did not return screenshot url');

  const { signal: s2, clear: c2 } = withTimeout(20000);
  const img = await fetch(shotUrl, { signal: s2 });
  c2();

  const ct = img.headers.get('content-type') || 'image/png';
  if (!img.ok || !ct.startsWith('image')) {
    throw new Error(`Microlink image failed: status=${img.status} type=${ct}`);
  }

  res.setHeader('Content-Type', ct);
  img.body.pipe(res);
}

// --- Ruta principal: stream screenshot ---
router.get('/screenshot', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl) return res.status(400).send('Falta parámetro ?url=');

  // Normaliza el esquema por si envían "example.com" sin http
  const url = /^https?:\/\//i.test(pageUrl) ? pageUrl : `http://${pageUrl}`;

  const provider = (req.query.provider || 'auto').toLowerCase();
  const opts = {
    full: toBool(req.query.full),
    width: req.query.width
  };

  try {
    if (provider === 'thum') {
      await streamFromThum(url, res, opts);
      return;
    }
    if (provider === 'microlink') {
      await streamFromMicrolink(url, res, opts);
      return;
    }

    // Auto: intenta Thum → fallback Microlink
    try {
      await streamFromThum(url, res, opts);
    } catch (e1) {
      console.warn('Thum.io falló, usando Microlink. Motivo:', e1.message);
      await streamFromMicrolink(url, res, opts);
    }
  } catch (err) {
    console.error('Error generando screenshot:', err);
    if (!res.headersSent) res.status(500).send('Error al generar captura');
  }
});

module.exports = router;
