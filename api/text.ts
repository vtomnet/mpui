import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getXml } from '../lib/llm.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    const response = await getXml(text);

    res.status(200).json({ result: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}
