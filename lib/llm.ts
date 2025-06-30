import OpenAI from 'openai';
import dotenv from 'dotenv';
import libxmljs from 'libxmljs2';
import fs from 'fs';
import path from 'path';
import Mustache from 'mustache';

Mustache.escape = text => text;

dotenv.config();

const openai = new OpenAI();

async function getFile(filename: string) {
  let filePath = path.join(process.cwd(), filename);
  let file = fs.readFileSync(filePath, "utf-8"); // XXX don't use readFileSync?
  return file;
}

export async function getXml(
  input: string,
  schemaName: string,
  geojsonName: string | undefined,
  snapshot,
) {
  // FIXME guard against someone using '../' in filename
  try {
    const schema = await getFile(`/public/schemas/${schemaName}.xsd`);
    const geojson = geojsonName ? await getFile(`/public/geojson/${geojsonName}.geojson`) : false;
    const systemPromptTmpl = await getFile("/resources/system_prompt.txt");
    console.log({ schema, geojson, snapshot });
    const systemPrompt = Mustache.render(systemPromptTmpl, { schema, geojson, snapshot });
    console.log("SYSTEM PROMPT:", systemPrompt);

    const content: OpenAI.Responses.ResponseInputItem.Message["content"] = [
      { type: "input_text", text: input }
    ];
    if (snapshot?.image) {
      content.push({
        type: "input_image",
        image_url: snapshot.image,
        detail: "high"
      });
    }
    console.log("CONTENT:", content);

    const response = await openai.responses.create({
      model: "o4-mini",
      input: [{ role: "user", content }],
      instructions: systemPrompt,
      reasoning: {
        effort: "low"
      }
    });
    console.log("LLM response:", response.output_text);

    if (response.output_text.startsWith("CLARIFY:")) {
      throw new Error(response.output_text);
    }

    const xmlDoc = libxmljs.parseXml(response.output_text);
    const xsdDoc = libxmljs.parseXml(schema);

    if (!xmlDoc.validate(xsdDoc)) {
      throw new Error(`LLM response failed to validate against provided XSD file (${schemaName}): ${response.output_text}`);
    }

    return response.output_text;
  } catch (error) {
    console.error('Fetch error:', error);
  }
}
