import dotenv from 'dotenv';
import path from 'path';
import { Client } from '@notionhq/client';

// .env 파일 로드
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

if (!process.env.NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY environment variable is not set');
}

const notionClient = new Client({
  auth: process.env.NOTION_API_KEY,
});

export default notionClient;
