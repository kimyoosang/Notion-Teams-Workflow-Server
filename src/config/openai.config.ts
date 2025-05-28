import dotenv from 'dotenv';
import path from 'path';
import { OpenAI } from 'openai';

// .env 파일 로드
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

interface OpenAIConfig {
  client: OpenAI;
  model: string;
  maxTokens: number;
  temperature: number;
}

const openaiConfig: OpenAIConfig = {
  client: new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
  model: 'gpt-3.5-turbo',
  maxTokens: 2000,
  temperature: 0.7,
};

export default openaiConfig;
