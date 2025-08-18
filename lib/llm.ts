import OpenAI from 'openai';
import dotenv from 'dotenv';
import libxmljs from 'libxmljs2';
import fs from 'fs';
import path from 'path';
import Mustache from 'mustache';

Mustache.escape = text => text;

dotenv.config();

const client = new OpenAI();

async function getFile(filename: string) {
  let filePath = path.join(process.cwd(), filename);
  let file = fs.readFileSync(filePath, "utf-8"); // XXX don't use readFileSync?
  return file;
}

export const models = [
  { name: "gpt-5", reasoning: "high" },
  { name: "gpt-5", reasoning: "medium" },
  { name: "gpt-5", reasoning: "low" },
  { name: "gpt-5", reasoning: "minimal" },
  { name: "gpt-5-mini", reasoning: "high" },
  { name: "gpt-5-mini", reasoning: "medium" },
  { name: "gpt-5-mini", reasoning: "low" },
  { name: "gpt-5-mini", reasoning: "minimal" },
];
export const modelList = models.map(m => `${m.name}/${m.reasoning}`);

export const schemaList = [
  "bd_spot",
  "clearpath_husky",
  "kinova_gen3_6dof",
  "gazebo_minimal",
];

export const geojsonList = [
  "reza",
  "ucm_graph40",
  "test",
  "none",
]

export async function getResponse(
  input: string,
  schemaName: string,
  geojsonName: string | null,
  model: string,
) {
  if (!schemaList.includes(schemaName)) {
    throw new Error(`Bad schema: ${schemaName}`);
  }
  if (geojsonName !== null && !geojsonList.includes(geojsonName)) {
    throw new Error(`Bad geojson: ${geojsonName}`);
  }
  if (!modelList.includes(model)) {
    throw new Error(`Bad model: ${model}`);
  }

  try {
    const schema = await getFile(`/public/schemas/${schemaName}.xsd`);
    const geojson = false; //geojsonName !== "none" ? await getFile(`/public/geojson/${geojsonName}.geojson`) : false;
    const systemPromptTmpl = await getFile("/resources/system_prompt.txt");
    console.log({ schema, geojson });
    const systemPrompt = Mustache.render(systemPromptTmpl, { schema, /*geojson*/ });
    console.log("SYSTEM PROMPT:", systemPrompt);

    const content: OpenAI.Responses.ResponseInputItem.Message["content"] = [
      { type: "input_text", text: input }
    ];
    console.log("CONTENT:", content);

    const slash = model.indexOf('/');
    const modelName = slash !== -1 ? model.slice(0, slash) : model;
    const reasoningEffort = slash !== -1 ? { effort: model.slice(slash+1) } : null;

    const response = await client.responses.create({
      model: modelName,
      input: [{ role: "user", content }],
      instructions: systemPrompt,
      reasoning: reasoningEffort,
    });
    console.log("LLM response:", response.output_text);

    const xmlDoc = libxmljs.parseXml(response.output_text);
    const xsdDoc = libxmljs.parseXml(schema);

    if (!xmlDoc.validate(xsdDoc)) {
      throw new Error(`LLM response failed to validate against provided XSD file (${schemaName}): ${response.output_text}`);
    }

    return response.output_text;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
