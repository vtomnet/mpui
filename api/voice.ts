import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { getResponse, modelList, schemaList, geojsonList } from '../lib/llm.js';

dotenv.config();

export const config = {
  api: { bodyParser: false }
};

const openai = new OpenAI();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files: formidable.Files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    const {
      schemaName: schemaNameField,
      geojsonName: geojsonNameField,
      model: modelField
    } = fields;
    if (!schemaNameField || !geojsonNameField || !modelField) {
      console.error(fields);
      return res.status(400).json({ error: "No schema/model name provided" });
    }

    const model = modelField[0] as string;
    const schemaName = schemaNameField[0];
    const geojsonName = geojsonNameField[0];

    if (!modelList.includes(model)) {
      console.error(`Bad model: ${model}`);
      return res.status(400).json({ error: "Unrecognized model" });
    }
    if (!schemaList.includes(schemaName)) {
      console.error(`Bad schema: ${schemaName}`);
      return res.status(400).json({ error: "Unrecognized schema" });
    }
    if (!geojsonList.includes(geojsonName)) {
      console.error(`Bad geojson: ${geojsonName}`);
      return res.status(400).json({ error: "Unrecognized geojson" });
    }

    const file = files.file;
    const audioFile = Array.isArray(file) ? file[0] : file;
    if (!audioFile || !('filepath' in audioFile)) {
      return res.status(400).json({ error: 'Audio file not provided correctly' });
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

    const transcript = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      prompt: "(farmer speaking)", // TODO
      file: fs.createReadStream(filepath),
    });
    console.log(`transcript: ${transcript.text}`);

    const response = await getResponse(transcript.text, schemaName, geojsonName, model);
    if (response === undefined) {
      return res.status(500).json({ error: "getResponse failed" });
    }

    return res.status(200).json({ result: response });
  });
}
