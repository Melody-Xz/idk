const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

router.get('/tiktok', async (req, res) => {
    const videoURL = req.query.url;

    if (!videoURL) {
        return res.status(400).json({ status: false, error: 'Falta el parámetro "url".' });
    }

    try {
        // Llamamos a la API de tikwm
        const apiRes = await fetch('https://www.tikwm.com/api/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoURL })
        });

        const data = await apiRes.json();

        if (data.code !== 0 || !data.data) {
            return res.status(500).json({
                status: false,
                error: data.msg || 'No se pudo procesar el video de TikTok.'
            });
        }

        const v = data.data;

        // Respuesta ordenada
        return res.status(200).json({
            creator: "Melody", // puedes poner tu nombre/tag
            status: true,
            process: Math.random().toFixed(4), // número aleatorio como en tu ejemplo
            data: {
                id: v.id,
                region: v.region,
                title: v.title,
                duration: v.duration,
                repro: v.play_count,
                like: v.digg_count,
                share: v.share_count,
                comment: v.comment_count,
                download: v.download_count,
                published: v.create_time,
                author: {
                    id: v.author.id,
                    username: `@${v.author.unique_id}`,
                    nickname: v.author.nickname
                },
                music: {
                    title: v.music_info?.title,
                    author: v.music_info?.author,
                    duration: v.music_info?.duration
                },
                media: {
                    type: "video",
                    size_org: `${(v.size / 1024 / 1024).toFixed(2)} MB`,
                    size_wm: v.wmplay ? "Desconocido" : null, // si no hay tamaño, se puede calcular si quieres
                    size_hd: v.hdplay ? "Desconocido" : null,
                    org: v.play,
                    wm: v.wmplay,
                    hd: v.hdplay,
                    music: v.music
                }
            }
        });

    } catch (error) {
        console.error("Error al procesar el video de TikTok:", error);
        return res.status(500).json({
            status: false,
            error: error.message || 'Error desconocido al procesar el video.'
        });
    }
});

module.exports = router;
