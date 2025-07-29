import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { getResponse, modelList, schemaList, geojsonList } from '../lib/llm.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI();
const PORT = process.env.PORT || 3001;

app.post('/api/text', async (req, res) => {
  try {
    const { text, schemaName, geojsonName, model } = req.body;
    if (!model || !modelList.includes(model)) {
      return res.status(401).json({ error: "Unrecognized or missing model" });
    }
    if (!schemaName || !schemaList.includes(schemaName)) {
      return res.status(402).json({ error: "Unrecognized or missing schema" });
    }
    if (!geojsonName || !geojsonList.includes(geojsonName)) {
      return res.status(403).json({ error: "Unrecognized or missing geojson" });
    }

    const response = await getResponse(text, schemaName, geojsonName, model);
    if (response === undefined) {
      return res.status(500).json({ error: "getResponse failed" });
    }

    return res.status(200).json({ result: response });
  } catch (e: any) {
    console.error("Error in text handler:", e);
    res.status(500).json({ error: e.message || 'An internal server error occurred.' });
  }
});


app.post('/api/voice', (req, res) => {
  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files: formidable.Files) => {
      // Set headers for streaming response
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Content-Encoding', 'none');

    if (err) {
      console.error(err);
      // Can't set headers here if they are already sent.
      // For simplicity, we assume form parsing error happens before we stream.
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      const {
        schemaName: schemaNameField,
        geojsonName: geojsonNameField,
        model: modelField
      } = fields;
      if (!schemaNameField || !geojsonNameField || !modelField) {
        throw new Error("No schema/model name provided");
      }

      const model = (modelField as string[])[0];
      const schemaName = (schemaNameField as string[])[0];
      const geojsonName = (geojsonNameField as string[])[0];

      if (!modelList.includes(model)) throw new Error(`Bad model: ${model}`);
      if (!schemaList.includes(schemaName)) throw new Error(`Bad schema: ${schemaName}`);
      if (!geojsonList.includes(geojsonName)) throw new Error(`Bad geojson: ${geojsonName}`);

      const file = files.file;
      const audioFile = Array.isArray(file) ? file[0] : file;
      if (!audioFile || !('filepath' in audioFile)) {
        throw new Error('Audio file not provided correctly');
      }

      let filepath = (audioFile as formidable.File).filepath;

      let filetype = await fileTypeFromFile(filepath);
      console.log('filetype:', filetype);
      if (filetype && !filepath.endsWith(filetype.ext)) {
        const newFilepath = filepath.replace(/\.?[^/.]+$/, `.${filetype.ext}`);
        console.log(newFilepath);
        fs.renameSync(filepath, newFilepath);
        filepath = newFilepath;
      }
      console.log('filepath:', filepath);

      res.status(200);
      res.flushHeaders();

      const transcript = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        prompt: "(farmer speaking)", // TODO
        file: fs.createReadStream(filepath),
      });
      console.log(`transcript: ${transcript.text}`);

      // 1. Send STT result immediately
      res.write(JSON.stringify({ stt: transcript.text }) + '\n');

      // 2. Get the full response and send it
      const response = await getResponse(transcript.text, schemaName, geojsonName, model);
      res.write(JSON.stringify({ result: response }) + '\n');

    } catch (e: any) {
      console.error("Error in voice handler:", e);
      // If headers are not sent, send a normal error response.
      if (!res.headersSent) {
        res.status(500).json({ error: e.message || 'An internal server error occurred.' });
      } else {
        // If stream has started, send an error object in the stream.
        res.write(JSON.stringify({ error: e.message || 'An error occurred during processing.' }) + '\n');
      }
    } finally {
      // End the response stream.
      if (!res.writableEnded) {
        res.end();
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
