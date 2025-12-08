// Importamos dependencias
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Ruta para acortar enlaces
router.get('/shortener', async (req, res) => {
    const originalUrl = req.query.url;

    // Validación
    if (!originalUrl) {
        return res.status(400).json({
            estado: "error",
            mensaje: 'Debes proporcionar una URL en el parámetro ?url='
        });
    }

    try {
        // Usamos el servicio de TinyURL
        const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(originalUrl)}`;
        const response = await fetch(apiUrl);
        const shortUrl = await response.text();

        // Si no devuelve nada, error
        if (!shortUrl || shortUrl.includes("Error")) {
            return res.status(500).json({
                estado: "error",
                mensaje: "No se pudo acortar el enlace con TinyURL"
            });
        }

        // Respuesta final
        res.json({
            estado: "éxito",
            creador: "Melody",
            url_original: originalUrl,
            url_acortada: shortUrl,
            servicio: "tinyurl"
        });

    } catch (error) {
        console.error("Error al acortar URL:", error.message);
        res.status(500).json({
            estado: "error",
            mensaje: error.message || "Error interno al acortar el enlace"
        });
    }
});

module.exports = router;
