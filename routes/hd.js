const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const router = express.Router();

const REPO_DIR = path.join(__dirname, '../Real-ESRGAN');
let isInstalled = false;

// Función que instala Real-ESRGAN si no está
async function ensureInstalled() {
  return new Promise((resolve, reject) => {
    if (isInstalled) return resolve();

    // Clonar repo e instalar dependencias
    exec(
      `git clone https://github.com/xinntao/Real-ESRGAN.git ${REPO_DIR} && cd ${REPO_DIR} && pip install -r requirements.txt`,
      (err, stdout, stderr) => {
        if (err) {
          console.error('Error instalando Real-ESRGAN:', stderr);
          return reject(new Error('No se pudo instalar Real-ESRGAN'));
        }
        console.log(stdout);
        isInstalled = true;
        resolve();
      }
    );
  });
}

router.get('/hd', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Debes proporcionar ?url=');

  try {
    // 1. Asegurar que Real-ESRGAN esté instalado
    await ensureInstalled();

    // 2. Descargar imagen de entrada
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo descargar la imagen');
    const inputPath = path.join(REPO_DIR, 'input.png');
    const outputPath = path.join(REPO_DIR, 'output.png');
    fs.writeFileSync(inputPath, Buffer.from(await response.arrayBuffer()));

    // 3. Ejecutar Real-ESRGAN
    exec(
      `cd ${REPO_DIR} && python inference_realesrgan.py -n RealESRGAN_x4plus -i input.png -o output.png`,
      (err, stdout, stderr) => {
        if (err) {
          console.error('Error procesando la imagen:', stderr);
          return res.status(500).send('Error procesando la imagen');
        }

        try {
          // 4. Devolver imagen mejorada
          const result = fs.readFileSync(outputPath);
          res.setHeader('Content-Type', 'image/png');
          res.send(result);
        } catch (e) {
          console.error('No se pudo leer el archivo de salida:', e);
          res.status(500).send('Error leyendo la imagen de salida');
        }
      }
    );
  } catch (err) {
    console.error('Error en /hd:', err);
    res.status(500).send('Error interno al mejorar la imagen');
  }
});

module.exports = router;
