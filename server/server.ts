import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import OpenAI from 'openai';

import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';

dotenv.config();

const openai = new OpenAI();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

async function query(input: string) {
  const response = await openai.responses.create({
    model: 'gpt-4.1-nano',
    input: input
  });
  return response.output_text;
}

app.post('/voice', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error("no file received");
    }

    // FIXME: this seems not ideal
    const tmp = `/tmp/${Date.now()}-${req.file.originalname}`;
    await fsp.writeFile(tmp, req.file.buffer);

    const transcript = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: fs.createReadStream(tmp),
      response_format: 'text',
      prompt: "The following input is instructions from a farmer on what an agtech robot should do."
    });

    console.log("GOT TRANSCRIPT:", transcript);

    const response = { message: await query(transcript) };
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).send((err as Error).message ?? 'server error');
  }
});

app.post('/text', async (req, res) => {
  const { text } = req.body;
  const response = { message: await query(text) };
  res.json(response);
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:3000')
});