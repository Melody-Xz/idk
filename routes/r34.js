const express = require('express');
const router = express.Router();

let fetchLib = globalThis.fetch;
if (!fetchLib) {
  try { fetchLib = require('node-fetch'); } catch (e) {}
}
const fetch = fetchLib;

const USER_ID = process.env.R34_USER_ID || '5405830';
const API_KEY = process.env.R34_API_KEY || '2b11e512aee1a0f952dd9cda56da50c441957c087278bc59a948fd2e7c9fdc21263580f4ee7a7927c36788ddedeaf64bfa79092750969aca4667966c4018992c';

router.get('/r34', async (req, res) => {
  try {
    if (!fetch) throw new Error('fetch no disponible. Usa Node >=18 o instala node-fetch.');

    const rawTag = req.query.tag || req.query.tags;
    if (!rawTag) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        error: 'Debes proporcionar ?tag= (ej: ?tag=son goku)'
      });
    }

    // Normalización correcta
    const tag = rawTag
      .trim()
      .split(/\s+/)
      .map(t => t.replace(/\s+/g, '_'))
      .join(' '); // separa tags con espacio

    const limitQuery = parseInt(req.query.limit) || 100;
    const limit = Math.min(limitQuery, 1000);
    const random = req.query.random === 'true' || req.query.random === '1';
    const pid = req.query.pid ? `&pid=${encodeURIComponent(req.query.pid)}` : '';

    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=${limit}&user_id=${USER_ID}&api_key=${API_KEY}${pid}`;

    const apiResponse = await fetch(url, { method: 'GET' });
    const raw = await apiResponse.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      return res.status(502).json({
        status: false,
        statusCode: 502,
        error: 'Respuesta inesperada del servidor rule34 (no JSON).',
        raw: raw.slice(0, 500)
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        status: true,
        statusCode: 200,
        creator: 'Melody',
        result: { count: 0, posts: [] }
      });
    }

    if (random) {
      const randomPost = data[Math.floor(Math.random() * data.length)];
      return res.json({
        status: true,
        statusCode: 200,
        creator: 'Melody',
        result: { post: randomPost }
      });
    }

    return res.json({
      status: true,
      statusCode: 200,
      creator: 'Melody',
      result: { count: data.length, posts: data.slice(0, limit) }
    });

  } catch (err) {
    console.error('Error en /api/r34:', err);
    return res.status(500).json({
      status: false,
      statusCode: 500,
      error: err.message || 'Error interno en la API'
    });
  }
});

module.exports = router;
