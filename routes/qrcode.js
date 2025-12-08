const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// 🔹 Ruta que genera y muestra directamente el QR en el navegador (stream PNG)
router.get('/qr', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).send('Falta parámetro ?text=');

  try {
    res.setHeader('Content-Type', 'image/png');
    // Generar y enviar el QR como stream
    QRCode.toFileStream(res, text, {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 6
    });
  } catch (err) {
    console.error('Error generando QR:', err);
    res.status(500).send('Error al generar QR');
  }
});

module.exports = router;
