const express = require('express');
const router = express.Router();

// ⚠️ Tu API Key. ¡No la dejes "quemada" en el código en un proyecto real!
const GEMINI_API_KEY = "AIzaSyDWxBQC_V3SO5euWuxSClbh2PeiTXTt1-4";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Ruta: /api/ai/chatgpt?text=Hola
router.get('/geminis', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      error: "Debes proporcionar un parámetro ?text="
    });
  }

  try {
    // 👇 Usamos fetch para hacer la petición POST directa a la API de Gemini
    const apiResponse = await fetch(`${API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Construimos el cuerpo (body) de la petición en el formato que la API espera
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: text
          }]
        }]
      })
    });

    if (!apiResponse.ok) {
        // Si la respuesta de la API no es exitosa, lanzamos un error
        const errorData = await apiResponse.json();
        throw new Error(`Error de la API: ${errorData.error.message}`);
    }

    const responseData = await apiResponse.json();
    
    // Extraemos el texto de la respuesta. La ruta puede ser un poco larga.
    const gptResponseText = responseData.candidates[0].content.parts[0].text;

    res.json({
      status: true,
      statusCode: 200,
      creator: "Melody",
      result: {
        response: gptResponseText
      }
    });

  } catch (err) {
    console.error("Error al contactar Google Gemini API:", err);
    res.status(500).json({
      status: false,
      statusCode: 500,
      error: err.message || "Error interno en la API de Gemini"
    });
  }
});

module.exports = router;