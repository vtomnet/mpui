import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getResponse } from "../lib/llm.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, schemaName, geojsonName } = req.body;

  const response = await getResponse(text, schemaName, geojsonName);
  if (response === undefined) {
    res.status(500).json({ error: "getResponse failed" });
  }

  res.status(200).json({ result: response });
}
