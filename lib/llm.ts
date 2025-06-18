import OpenAI from 'openai';
import dotenv from 'dotenv';

import { SYSTEM_PROMPT } from './systemPrompt.js';

dotenv.config();

const openai = new OpenAI();

export async function getXml(input: string) {
  return openai.responses.create({
    model: "o3",
    input: input,
    instructions: SYSTEM_PROMPT,
    reasoning: {
      effort: 'low'
    }
  });
}
