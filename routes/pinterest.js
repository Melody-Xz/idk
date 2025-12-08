// routes/pinterest.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

async function pinterestScraper(query, limit = 25) {
    const link = `https://id.pinterest.com/resource/BaseSearchResource/get/?source_url=%2Fsearch%2Fpins%2F%3Fq%3D${encodeURIComponent(query)}%26rs%3Dtyped&data=%7B%22options%22%3A%7B%22query%22%3A%22${encodeURIComponent(query)}%22%2C%22scope%22%3A%22pins%22%2C%22rs%22%3A%22typed%22%7D%2C%22context%22%3A%7B%7D%7D`;

    const headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        'referer': 'https://id.pinterest.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'x-app-version': 'c056fb7',
        'x-pinterest-appstate': 'active',
        'x-pinterest-pws-handler': 'www/index.js',
        'x-pinterest-source-url': '/',
        'x-requested-with': 'XMLHttpRequest'
    };

    const res = await axios.get(link, { headers });

    if (!res.data?.resource_response?.data?.results) return [];

    const results = res.data.resource_response.data.results
        .map(item => {
            if (!item.images) return null;

            // Buscar automáticamente una imagen intermedia (ni muy grande ni muy chica)
            const imageKeys = Object.keys(item.images);
            const mediumKey = imageKeys.find(k => /4\d{2}x|5\d{2}x|6\d{2}x/.test(k)) || imageKeys[0];
            const image_medium = item.images[mediumKey]?.url || null;

            return {
                title: item.grid_title || item.title || 'Sin título',
                image_large_url: item.images.orig?.url || null,
                image_medium_url: image_medium,
                image_small_url: item.images['236x']?.url || null
            };
        })
        .filter(Boolean);

    return results.slice(0, limit);
}

router.get('/pinterest', async (req, res) => {
    const query = req.query.q;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 25;

    if (!query) {
        return res.status(400).json({
            status: false,
            error: "❌ Debes proporcionar un parámetro de búsqueda ?q="
        });
    }

    try {
        const images = await pinterestScraper(query, limit);

        if (!images.length) {
            return res.status(404).json({
                status: false,
                error: `No se encontraron imágenes para '${query}'.`
            });
        }

        res.json({
            status: true,
            creator: "Melody",
            engine: "Motor de búsquedas de imágenes desde Pinterest",
            query,
            results_count: images.length,
            results: images
        });

    } catch (err) {
        console.error('Error en Pinterest scraper:', err);
        res.status(500).json({
            status: false,
            error: 'Ocurrió un error al scrapear Pinterest.',
            details: err.message
        });
    }
});

module.exports = router;
