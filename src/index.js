require('dotenv').config();
const express = require('express');
const { handleTeamsWebhook } = require('./services/teams');
const { getNotionPageContent } = require('./services/notion');
const { convertTextToJson } = require('./services/teams');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(
  bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Teams 웹훅 엔드포인트
app.post('/api/teams/webhook', handleTeamsWebhook);

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  // 서버 실행
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  });

  // 테스트용 main 함수 (직접 실행 시만 동작)
  // PageID를 환경변수나 인자로 받아서 실행
  const testPageId = process.env.PageID || process.env.PAGE_ID || process.argv[2];
  if (testPageId) {
    (async () => {
      const { title, bodyText } = await getNotionPageContent(testPageId);
      console.log('노션 페이지 제목:', title);
      console.log('노션 페이지 본문:', bodyText);
      const jsonResult = await convertTextToJson(title, bodyText);
      console.log('LLM이 변환한 JSON:', jsonResult);
      // 파일 저장
      const pocDir = path.join(__dirname, 'poc');
      if (!fs.existsSync(pocDir)) {
        fs.mkdirSync(pocDir);
      }
      const safeTitle = title.replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
      const fileName = `${safeTitle}_${Date.now()}.json`;
      const filePath = path.join(pocDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(jsonResult, null, 2), 'utf-8');
      console.log('JSON 파일 저장 완료:', filePath);
    })();
  }
}
