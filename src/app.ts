import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import notionRoutes from './routes/notion.routes';
import teamsRoutes from './routes/teams.routes';

dotenv.config();

const app = express();

// 미들웨어 설정
app.use(
  express.json({
    verify: (_req: Request, _res: Response, buf: Buffer) => {
      (_req as any).rawBody = buf;
    },
  })
);

// 라우트 설정
app.use('/api/notion', notionRoutes);
app.use('/api/teams', teamsRoutes);

// 에러 핸들링 미들웨어
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('에러 발생:', err);
  res.status(500).json({
    error: '서버 에러가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
