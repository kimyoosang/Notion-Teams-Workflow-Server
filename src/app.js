require('dotenv').config();
const express = require('express');
const notionRoutes = require('./routes/notion.routes');
const teamsRoutes = require('./routes/teams.routes');

const app = express();

// 미들웨어 설정
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// 라우트 설정
app.use('/api/notion', notionRoutes);
app.use('/api/teams', teamsRoutes);

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('에러 발생:', err);
  res.status(500).json({
    error: '서버 에러가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
