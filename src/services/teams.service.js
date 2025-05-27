const teamsConfig = require('../config/teams.config');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const notionService = require('./notion.service');
const openaiConfig = require('../config/openai.config');

const openai = openaiConfig.client;

// 중복 메시지 방지용 Set (10분 유지)
const processedMessageIds = new Set();

const addProcessedMessageId = messageId => {
  processedMessageIds.add(messageId);
  setTimeout(() => processedMessageIds.delete(messageId), 10 * 60 * 1000); // 10분 후 삭제
};

const createTeamsMessage = ({ id, title }) => ({
  type: 'message',
  attachments: [
    {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'TextBlock',
            text: `새로운 문서가 업데이트되었습니다: ${title}`,
          },
        ],
      },
    },
  ],
});

// 일반 알림용
const sendNotification = async ({ id, title, url, text }) => {
  const message = createTeamsMessage({ id, title: text ? `${title}\n${text}` : title });
  await teamsConfig.axiosInstance.post('', message);
};

// 질문 답변용
const sendQuestionAnswer = async ({ text, teamsConversationId }) => {
  // 질문/답변만 전송
  const message = {
    text,
  };
  await teamsConfig.questionAxiosInstance.post('', message);
};

// 시그니처 검증 (타입별)
const verifyWebhookSignature = (req, type = 'default') => {
  let secret;
  if (type === 'question') {
    secret = Buffer.from(teamsConfig.questionWebhookSecret, 'base64');
  } else {
    secret = Buffer.from(teamsConfig.webhookSecret, 'base64');
  }
  const auth = req.headers['authorization'];
  const msgHash =
    'HMAC ' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  return msgHash === auth;
};

const isDuplicateMessage = messageId => {
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  addProcessedMessageId(messageId);
  return false;
};

const extractPageIdFromText = text => {
  console.log('Teams Webhook text 원본:', text);
  let plain = text || '';
  plain = plain.replace(/<[^>]+>/g, ' ');
  plain = plain.replace(/&nbsp;/g, ' ');
  plain = plain.replace(/[\r\n]+/g, ' ');
  plain = plain.replace(/\s+/g, ' ');
  console.log('PageID 추출용 변환 결과:', plain);
  const match = plain.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
  );
  console.log('PageID 추출 결과:', match ? match[0] : null);
  return match ? match[0] : null;
};

// 핵심 비즈니스 로직: Notion → OpenAI → 파일저장 → Teams 알림
const processTeamsWebhook = async ({ id: messageId, text }) => {
  // 1. Notion 페이지 ID 추출
  const pageId = extractPageIdFromText(text);
  if (!pageId) throw new Error('PageID를 찾을 수 없습니다.');

  // 2. Notion 페이지 내용 가져오기
  const { title, bodyText } = await notionService.getPageContent(pageId);
  if (!bodyText) throw new Error('Notion 페이지 내용이 비어있습니다.');

  // 3. OpenAI에 JSON+코드 동시 생성 요청
  const completion = await openai.chat.completions.create({
    model: openaiConfig.model,
    messages: [
      {
        role: 'system',
        content: `Implement fully functional JavaScript code that satisfies all requirements and flows described in the following software specification.\n- Do NOT write any HTML or CSS, only JavaScript code (functionality implementation).\n- The code should be a single JS file and must run without errors.\n- Assume that any required DOM elements are either created in JavaScript or already exist.\n- The code must not contain syntax errors.\n- Do NOT include unnecessary comments, explanations, examples, HTML, or CSS.\n- There must be no unimplemented parts, no TODOs, and no comments like /* ... */. All logic must be fully implemented and runnable.\n\nRespond with BOTH a JSON code block and a JavaScript code block, in this order.\nThe JSON code block MUST contain the full feature specification as a JSON object, not an empty object.\nDo NOT omit either block, even if you think one is redundant.\n\nRespond in the following format:\n\n\"\"\"json\n{...}\n\"\"\"\n\n\"\"\"javascript\n// complete code\n\"\"\"\n`,
      },
      {
        role: 'user',
        content: `Below is the software feature specification as a JSON object.\n\n${bodyText}`,
      },
    ],
    max_tokens: openaiConfig.maxTokens,
    temperature: openaiConfig.temperature,
  });

  const response = completion.choices[0].message.content;
  console.log('OpenAI 응답:', response);
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
  const codeMatch =
    response.match(/```javascript\s*([\s\S]*?)\s*```/i) ||
    response.match(/```js\s*([\s\S]*?)\s*```/i) ||
    response.match(/```\s*([\s\S]*?)\s*```/i);

  if (!codeMatch) {
    throw new Error('OpenAI 응답에서 코드 블록을 찾을 수 없습니다.');
  }
  if (!jsonMatch) {
    throw new Error('OpenAI 응답에서 JSON 블록을 찾을 수 없습니다.');
  }

  const json = JSON.parse(jsonMatch[1]);
  const code = codeMatch[1];

  // 4. 파일 저장
  const pocBaseDir = path.join(__dirname, '../poc');
  const { folderName, folderPath, fileBase } =
    await require('../utils/dateFolder.util').getNextFolderAndFileName(pocBaseDir);
  await fs.mkdir(folderPath, { recursive: true });
  const jsonPath = path.join(folderPath, `${fileBase}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2));
  const jsPath = path.join(folderPath, `${fileBase}.js`);
  await fs.writeFile(jsPath, code);

  // 5. Teams 알림 전송 (코드 생성/알림용 Webhook만)
  await sendNotification({
    id: pageId,
    title,
    url: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
  });

  console.log('Teams webhook 처리 완료:', { messageId, pageId });
};

module.exports = {
  sendNotification,
  sendQuestionAnswer,
  verifyWebhookSignature,
  isDuplicateMessage,
  extractPageIdFromText,
  processTeamsWebhook,
};
