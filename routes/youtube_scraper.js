const axios = require("axios");
const yts = require("yt-search");
const { createDecipheriv } = require('crypto');

//================================================================
// >> LÓGICA DE SERVICIOS EXTERNOS Y MEJORAS
//================================================================

/**
 * ✨ MEJORA: Ejecuta una función con reintentos automáticos.
 * Si falla, espera 200ms y lo intenta de nuevo, hasta un máximo de 3 veces.
 * @param {Function} fn La función asíncrona a ejecutar.
 */
async function withRetries(fn) {
    let lastError;
    for (let i = 0; i < 3; i++) {
        try {
            return await fn(); // Si tiene éxito, devuelve el resultado
        } catch (error) {
            lastError = error;
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 200)); // Espera antes de reintentar
        }
    }
    throw lastError; // Si todos los intentos fallan, lanza el último error
}

const hexcode = (hex) => Buffer.from(hex, 'hex');

function decode(enc) {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = hexcode(secret_key);
        const decipher = createDecipheriv('aes-128-cbc', key, iv);
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (error) {
        throw new Error("Fallo en la decodificación: " + error.message);
    }
}

/**
 * Función interna para obtener la información base de Savetube (CDN y clave).
 * @param {string} link URL de YouTube.
 */
async function _getSavetubeInfo(link) {
    const cdnResponse = await axios.get("https://media.savetube.me/api/random-cdn", { timeout: 7000 });
    const cdn = cdnResponse?.data?.cdn;
    if (!cdn) throw new Error('No se pudo obtener un CDN de Savetube.');

    const infoResponse = await axios.post(`https://${cdn}/v2/info`, { url: link }, { timeout: 7000 });
    if (!infoResponse?.data?.data) throw new Error('No se obtuvo información del video de Savetube.');
    
    const info = decode(infoResponse.data.data);
    if (!info.key) throw new Error('No se pudo decodificar la clave de descarga.');

    return { cdn, info };
}

/**
 * Obtiene el enlace de descarga de AUDIO desde Savetube.
 * @param {string} link URL de YouTube.
 */
async function _fetchAudioFromSavetube(link) {
    return withRetries(async () => {
        const { cdn, info } = await _getSavetubeInfo(link);

        const downloadResponse = await axios.post(`https://${cdn}/download`, {
            'downloadType': 'audio',
            'quality': '128',
            'key': info.key
        }, { timeout: 7000 });

        const downloadUrl = downloadResponse?.data?.data?.downloadUrl || downloadResponse?.data?.downloadUrl;
        if (!downloadUrl) throw new Error('No se pudo obtener el enlace de descarga de audio final.');
        
        return { title: info.title, mp3: downloadUrl };
    });
}

/**
 * ✅ NUEVA FUNCIÓN: Obtiene el enlace de descarga de VIDEO desde Savetube.
 * @param {string} link URL de YouTube.
 */
async function _fetchVideoFromSavetube(link) {
    return withRetries(async () => {
        const { cdn, info } = await _getSavetubeInfo(link);

        const downloadResponse = await axios.post(`https://${cdn}/download`, {
            'downloadType': 'video', // <-- Cambio clave aquí
            'quality': '360',       // <-- Calidad de video
            'key': info.key
        }, { timeout: 7000 });

        const downloadUrl = downloadResponse?.data?.data?.downloadUrl || downloadResponse?.data?.downloadUrl;
        if (!downloadUrl) throw new Error('No se pudo obtener el enlace de descarga de video final.');
        
        return { title: info.title, mp4: downloadUrl };
    });
}

function getYouTubeVideoId(url) {
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:.*v=|[^\/]+\/.+\/|.*embed\/))([^&?\/]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

//================================================================
// >> LÓGICA PRINCIPAL MÁS ROBUSTA Y EFICIENTE
//================================================================
async function handleDownload(link, type) {
    const videoId = getYouTubeVideoId(link);
    if (!videoId) return { status: false, message: "URL de YouTube inválida." };

    try {
        // ✅ ACTUALIZADO: Ahora usa _fetchVideoFromSavetube para MP4
        const downloadFetcher = type === 'mp3' 
            ? _fetchAudioFromSavetube(link) 
            : _fetchVideoFromSavetube(link);
            
        const results = await Promise.allSettled([
            yts({ videoId }),
            downloadFetcher
        ]);
        
        const metadataResult = results[0];
        const downloadResult = results[1];

        if (downloadResult.status === 'rejected') {
            throw new Error(downloadResult.reason.message);
        }

        const downloadLinks = downloadResult.value;
        const downloadUrl = type === 'mp3' ? downloadLinks.mp3 : downloadLinks.mp4;

        const metadata = metadataResult.status === 'fulfilled' ? metadataResult.value : {};
        const title = metadata.title || downloadLinks.title || 'video';

        return {
            status: true,
            metadata: {
                title: title, thumbnail: metadata.thumbnail,
                duration: metadata.duration, author: metadata.author?.name, url: metadata.url
            },
            download: {
                quality: type === 'mp3' ? '128kbps' : '360p',
                url: downloadUrl, filename: `${title}.${type}`
            }
        };
    } catch (error) {
        return { status: false, message: error.message };
    }
}

const ytmp3 = (link) => handleDownload(link, 'mp3');
const ytmp4 = (link) => handleDownload(link, 'mp4');

async function ytdlv2(link) {
    try {
        const videoId = getYouTubeVideoId(link);
        if (!videoId) return { status: false, message: "URL de YouTube inválida." };

        const results = await Promise.allSettled([
            yts({ videoId }),
            _fetchAudioFromSavetube(link),
            _fetchVideoFromSavetube(link) // ✅ ACTUALIZADO: Usa la nueva función de video
        ]);

        const metadata = results[0].status === 'fulfilled' ? results[0].value : {};
        const audioLinks = results[1].status === 'fulfilled' ? results[1].value : null;
        const videoLinks = results[2].status === 'fulfilled' ? results[2].value : null;
        
        if (!audioLinks && !videoLinks) {
             throw new Error("Fallaron tanto la descarga de audio como la de video.");
        }

        return {
            status: true,
            metadata: {
                title: metadata.title || audioLinks?.title || videoLinks?.title || 'video',
                thumbnail: metadata.thumbnail,
                duration: metadata.duration, author: metadata.author?.name, url: metadata.url
            },
            downloads: { audio: audioLinks?.mp3 || null, video: videoLinks?.mp4 || null }
        };
    } catch (error) {
        return { status: false, message: error.message };
    }
}

module.exports = {
    ytmp3,
    ytmp4,
    ytdlv2
};