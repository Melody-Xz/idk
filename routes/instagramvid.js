// Importamos dependencias
const express = require('express');
const router = express.Router();
const { igdl } = require('ruhend-scraper');

// Ruta para descargar videos de Instagram
router.get('/instagram', async (req, res) => {
    const url = req.query.url;

    // Validación básica
    if (!url) {
        return res.status(400).json({
            status: false,
            error: 'Debes proporcionar un enlace de Instagram en el parámetro ?url='
        });
    }

    try {
        // Usamos ruhend-scraper para obtener el video
        const result = await igdl(url);

        if (!result || !result.data || result.data.length === 0) {
            return res.status(404).json({
                status: false,
                error: 'No se pudo obtener el video. Puede que el enlace no sea válido.'
            });
        }

        // Retornamos la información con el creador como extra
        res.json({
            status: true,
            creator: 'Melody',
            video: result.data.map(item => ({
                url: item.url,
                type: item.type || 'video',
                thumbnail: item.thumbnail || null
            }))
        });

    } catch (error) {
        console.error('Error al procesar el video de Instagram:', error.message);
        res.status(500).json({
            status: false,
            error: error.message || 'Error al procesar el video de Instagram'
        });
    }
});

module.exports = router;
