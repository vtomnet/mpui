import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import formidable from 'formidable';
import fs from 'fs';
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

    try {
      const file = files.file;
      const audioFile = Array.isArray(file) ? file[0] : file;
      if (!audioFile || !('filepath' in audioFile)) {
        return res.status(400).json({ error: 'Audio file not provided correctly' });
      }

      let filepath = (audioFile as formidable.File).filepath;

      if (!filepath.endsWith('.webm')) {
        const newFilepath = `${filepath}.mp4`;
        fs.renameSync(filepath, newFilepath);
        filepath = newFilepath;
      }
      console.log('filepath:', filepath);

      const transcript = await openai.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        prompt: "(farmer speaking)",
        file: fs.createReadStream(filepath),
      });
      console.log(`transcript: ${transcript.text}`);

      const response = await getXml(transcript.text);

      res.status(200).json({ result: response.output_text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong' });
    }
  });
}
