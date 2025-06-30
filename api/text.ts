import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getXml } from '../lib/llm.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, schemaName, geojsonName, snapshot } = req.body;

    const response = await getXml(text, schemaName, geojsonName, snapshot);
    if (response === undefined) {
      throw new Error('getXml failed');
    }

    res.status(200).json({ result: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
}
