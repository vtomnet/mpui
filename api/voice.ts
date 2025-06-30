import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
import { fileTypeFromFile } from 'file-type';
import { getXml } from '../lib/llm.js';

dotenv.config();

export const config = {
  api: {
    bodyParser: false
  }
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

    const { schemaName, geojsonName, image, north_west, north_east, south_west, south_east, center } = fields;

    const snapshot = image ? {
      image: image as string,
      north_west: JSON.parse(north_west as string),
      north_east: JSON.parse(north_east as string),
      south_west: JSON.parse(south_west as string),
      south_east: JSON.parse(south_east as string),
      center: JSON.parse(center as string),
    } : undefined;

    try {
      const file = files.file;
      const audioFile = Array.isArray(file) ? file[0] : file;
      if (!audioFile || !('filepath' in audioFile)) {
        return res.status(400).json({ error: 'Audio file not provided correctly' });
      }

      let filepath = (audioFile as formidable.File).filepath;

      let filetype = await fileTypeFromFile(filepath);
      if (filetype && !filepath.endsWith(filetype.ext)) {
        const newFilepath = filepath.replace(/\.[^/.]+$/, filetype.ext);
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

      const response = await getXml(transcript.text, schemaName as string, geojsonName as string, snapshot);
      if (response === undefined) {
        throw new Error('getXml failed');
      }

      res.status(200).json({ result: response });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
}
