import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getResponse, modelList, schemaList, geojsonList } from "../lib/llm.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, schemaName, geojsonName, model } = req.body;
  if (!modelList.includes(model)) {
    return res.status(401).json({ error: "Unrecognized model" });
  }
  if (!schemaList.includes(schemaName)) {
    return res.status(402).json({ error: "Unrecognized schema" });
  }
  if (!geojsonList.includes(geojsonName)) {
    return res.status(403).json({ error: "Unrecognized geojson" });
  }

  const response = await getResponse(text, schemaName, geojsonName, model);
  if (response === undefined) {
    return res.status(500).json({ error: "getResponse failed" });
  }

  return res.status(200).json({ result: response });
}
