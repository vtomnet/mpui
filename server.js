import express from 'express';
import multer from 'multer';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAI } from 'openai';

const openai = new OpenAI();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pubDir = path.join(__dirname, 'pub');
const promptPath = path.join(__dirname, 'sysprompt.txt');

let systemPrompt = '';
try {
  systemPrompt = await fsp.readFile(promptPath, 'utf8');
  console.log("Loaded sysprompt");
} catch (err) {
  console.error("Cannot read sysprompt.txt", err);
  process.exit(1);
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(pubDir));

app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error("no file received");

    // Write buffer to a temp file because the SDK expects a real stream
    const tmp = `/tmp/${Date.now()}-${req.file.originalname}`;
    await fsp.writeFile(tmp, req.file.buffer);

    // 1 . speech-to-text
    const transcript = await openai.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file: fs.createReadStream(tmp),
      // webm/opus is fine; default language auto-detect
      response_format: 'text',
      prompt: "The following input is instructions from a farmer on what an agtech robot should do. The farmer is located in California, so the input is probably either English or Spanish. If no sensible input, here is a default fallback prompt: 'take a picture of 5 random trees'",
      // TODO consider providing the exact specs of the robot and the farm, and customize user's location and maybe default language
    });

    console.log("GOT TRANSCRIPT:", transcript);

    // 2 . chat call that returns XML
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ]
    });

    console.log("GOT COMPLETION:", completion);
    console.log("GOT MESSAGE:", completion.choices[0].message.content);

    await fsp.unlink(tmp);                       // tidy up

    res.json({ xml: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message ?? 'server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API server listening on ${PORT}`));