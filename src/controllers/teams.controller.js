const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const teamsService = require('../services/teams.service');
const notionService = require('../services/notion.service');
const openaiConfig = require('../config/openai.config');
const { getTodayBaseName, getNextFolderAndFileName } = require('../utils/dateFolder.util');
const { generateDraftJsCode } = require('../utils/codegen.util');

const openai = new OpenAI(openaiConfig);

const convertTextToJson = async text => {
  const prompt = `
    다음은 소프트웨어 명세서 문서입니다. 이 문서를 JSON 형식으로 변환해주세요.
    각 섹션은 객체로 변환하고, 하위 항목은 배열로 변환해주세요.
    키는 영문으로 변환해주세요.
    
    문서 내용:
    ${text}
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: openaiConfig.model,
    max_tokens: openaiConfig.maxTokens,
    temperature: openaiConfig.temperature,
  });

  return JSON.parse(completion.choices[0].message.content);
};

const saveJsonAndGenerateCode = async (json, pageId) => {
  const pocBaseDir = path.join(__dirname, '../poc');
  const { folderName, folderPath, fileBase } = await getNextFolderAndFileName(pocBaseDir);

  // 폴더 생성
  await fs.mkdir(folderPath, { recursive: true });

  // 파일 저장
  const jsonPath = path.join(folderPath, `${fileBase}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2));
  console.log('JSON 파일 저장 완료:', jsonPath);

  const code = generateDraftJsCode(json);
  if (code) {
    const jsPath = path.join(folderPath, `${fileBase}.js`);
    await fs.writeFile(jsPath, code);
    console.log('JS 파일 저장 완료:', jsPath);
  }
};

const handleWebhook = async (req, res) => {
  // 1. 먼저 빠른 응답을 보냄
  res.status(200).json({
    type: 'message',
    text: '요청을 받았습니다. 처리 중입니다...',
  });

  try {
    // 2. 요청 검증
    if (!teamsService.verifyWebhookSignature(req)) {
      console.error('Teams HMAC 인증 실패');
      return;
    }

    const { id: messageId, text } = req.body;
    if (!messageId || !text) {
      console.error('필수 필드 누락:', { messageId, text });
      return;
    }

    // 3. 중복 메시지 체크
    if (teamsService.isDuplicateMessage(messageId)) {
      console.log('중복 메시지 감지, 처리 건너뜀:', messageId);
      return;
    }

    // 4. Page ID 추출
    const pageId = teamsService.extractPageIdFromText(text);
    if (!pageId) {
      console.error('PageID를 찾을 수 없습니다:', text);
      return;
    }

    // 5. Notion 페이지 내용 가져오기
    const { title, bodyText } = await notionService.getPageContent(pageId);
    if (!bodyText) {
      console.error('Notion 페이지 내용이 비어있습니다:', pageId);
      return;
    }

    // 6. JSON 변환 및 코드 생성
    const json = await convertTextToJson(bodyText);
    if (!json) {
      console.error('JSON 변환 실패:', bodyText);
      return;
    }

    // 7. 파일 저장
    await saveJsonAndGenerateCode(json, pageId);

    // 8. Teams에 알림 전송
    await teamsService.sendNotification({
      id: pageId,
      title,
      url: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
    });

    console.log('Teams webhook 처리 완료:', { messageId, pageId });
  } catch (error) {
    console.error('Teams webhook 처리 중 에러 발생:', error);
  }
};

module.exports = {
  handleWebhook,
};
