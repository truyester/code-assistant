import express from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";
import { marked } from 'marked';

dotenv.config();

// Clientes de API (requieren OPENAI_API_KEY / GEMINI_API_KEY en .env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());
// Registrador simple para diagnosticar solicitudes que se quedan colgadas
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', async (req, res) => {
  res.status(200).send({ message: 'Hello!' });
});

const chatHandler = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    // Instrucciones comunes para mantener el tono y estructura de las respuestas
    const INSTRUCTIONS = `
Eres un asistente de aprendizaje de Python para hispanohablantes.
- Responde SIEMPRE en español.
- Asume que el usuario es principiante si no dice lo contrario.
- Orden de respuesta: 1) Explicación, 2) Código en Python explicado bloque por bloque, 3) Posible salida del código.
- Si preguntan por otros lenguajes, responde brevemente y regresa a Python.
`.trim();
    // Genera el prompt final que se envía al modelo
    const buildPrompt = (userPrompt) => `${INSTRUCTIONS}\n\nPregunta del usuario:\n${userPrompt || ''}`.trim();

    if (model === 'gemini') {
      // Verifica que exista clave para Gemini
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).send({
          error: "La clave de la API de Gemini no está configurada.",
        });
      }

      // Llama a Gemini con el prompt formateado y un límite de salida
      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: buildPrompt(prompt),
        generationConfig: {
          maxOutputTokens: 300,
        },
      });

      if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
        return res.status(500).send({
          error: "Respuesta inesperada de la API de Gemini.",
        });
      }

      const rawText = response.candidates[0].content.parts[0].text;
      const RenderTextHTML = marked.parse(rawText);
      const botResponse = response.candidates[0].content.parts[0].text;

      console.log(RenderTextHTML);

      // 4. Envía la respuesta del bot al cliente
      return res.status(200).send({
        bot: RenderTextHTML,
      });
    }

    // Valida la API key para fallar rápido si falta, en lugar de quedar colgado
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).send({ error: 'OPENAI_API_KEY no está configurada.' });
    }

    // Llama a OpenAI Chat con mensajes system+user siguiendo las mismas instrucciones
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: buildPrompt(prompt) },
      ],
      temperature: 0.2,
      max_tokens: 300,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });

    const openaiText = response.choices[0].message?.content?.trim() || '';
    // Procesa como Markdown para entregar HTML consistente con Gemini
    const RenderTextHTML = marked.parse(openaiText);

    res.status(200).send({
      bot: RenderTextHTML,
    });

  } catch (error) {
    console.error(error);
    res.status(500).send(error || 'Something went wrong');
  }
};

// Expone el handler tanto en / como en /api para compatibilidad con frontends
app.post(['/', '/api', '/api/'], chatHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log('AI server started on http://localhost:5001'));
