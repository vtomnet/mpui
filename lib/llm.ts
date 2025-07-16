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

export const modelList = [
  "o3",
  "o4-mini",
  "gpt-4.1",
  "gpt-4.1-nano",
];

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
  geojsonName: string,
  model: string,
) {
  if (!schemaList.includes(schemaName)) {
    console.error("Bad schema:", schemaName);
    return;
  }
  if (!geojsonList.includes(geojsonName)) {
    console.error("Bad geojson:", geojsonName);
    return;
  }
  if (!modelList.includes(model)) {
    console.error("Bad model:", model);
    return;
  }

//   return `\
// <TaskTemplate xmlns="https://robotics.ucmerced.edu/task"
//               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
//               xsi:schemaLocation="https://robotics.ucmerced.edu/task schemas/schemas/gazebo_minimal.xsd">

//     <CompositeTaskInformation>
//         <TaskID>move_forward_and_face_left</TaskID>
//         <TaskDescription>move the husky forward a meter and facing left</TaskDescription>
//     </CompositeTaskInformation>

//     <AtomicTasks>
//         <AtomicTask>
//             <TaskID>move_forward_one_meter_and_turn_left</TaskID>
//             <TaskDescription>Move the Husky robot forward 1 meter and rotate to face left (90 degrees counterclockwise)</TaskDescription>
//             <Action>
//                 <ActionType>moveToRelativeLocation</ActionType>
//                 <moveToRelativeLocation>
//                     <x>1.0</x>
//                     <y>0.0</y>
//                     <roll>0.0</roll>
//                     <pitch>0.0</pitch>
//                     <yaw>1.5708</yaw>
//                 </moveToRelativeLocation>
//             </Action>
//         </AtomicTask>
//     </AtomicTasks>

//     <ActionSequence>
//         <Sequence>
//             <TaskID>move_forward_one_meter_and_turn_left</TaskID>
//         </Sequence>
//     </ActionSequence>

// </TaskTemplate>`;

  try {
    const schema = await getFile(`/public/schemas/${schemaName}.xsd`);
    const geojson = geojsonName != "none" ? await getFile(`/public/geojson/${geojsonName}.geojson`) : false;
    const systemPromptTmpl = await getFile("/resources/system_prompt.txt");
    console.log({ schema, geojson });
    const systemPrompt = Mustache.render(systemPromptTmpl, { schema, geojson });
    console.log("SYSTEM PROMPT:", systemPrompt);

    const content: OpenAI.Responses.ResponseInputItem.Message["content"] = [
      { type: "input_text", text: input }
    ];
    console.log("CONTENT:", content);

    const response = await client.responses.create({
      model: model,
      input: [{ role: "user", content }],
      instructions: systemPrompt,
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
  }
}
