import dotenv from 'dotenv';
import path from 'path';
import app from './app';

const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

console.log('Environment variables loaded:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
  NOTION_API_KEY: process.env.NOTION_API_KEY ? 'Set' : 'Not set',
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL ? 'Set' : 'Not set',
});

const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
