import express from 'express';
import * as dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";
import { marked } from 'marked';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
  res.status(200).send({ message: 'Hello!' });
});

app.post('/', async (req, res) => {
  try {
    const { prompt, model } = req.body;

    if (model === 'gemini') {
      // 1. Verifica si la clave de la API de Gemini está configurada
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).send({
          error: "La clave de la API de Gemini no está configurada.",
        });
      }

      // 2. Obtén el modelo Gemini Pro
      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
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

    const response = await openai.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: prompt,
      temperature: 0,
      max_tokens: 300,
      top_p: 1,
      frequency_penalty: 0.5,
      presence_penalty: 0,
    });

    res.status(200).send({
      bot: response.choices[0].text.trim(),
    });

  } catch (error) {
    console.error(error);
    res.status(500).send(error || 'Something went wrong');
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log('AI server started on http://localhost:5001'));

