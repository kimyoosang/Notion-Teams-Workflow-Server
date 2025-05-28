import { Request } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import teamsConfig from '../config/teams.config';
import notionService from './notion.service';
import openaiConfig from '../config/openai.config';
import { getNextFolderAndFileName } from '../utils/dateFolder.util';

const openai = openaiConfig.client;

// 중복 메시지 방지용 Set (10분 유지)
const processedMessageIds = new Set<string>();

const addProcessedMessageId = (messageId: string) => {
  processedMessageIds.add(messageId);
  setTimeout(() => processedMessageIds.delete(messageId), 10 * 60 * 1000); // 10분 후 삭제
};

const createTeamsMessage = ({ title }: { id: string; title: string }) => ({
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
const sendNotification = async ({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  url: string;
  text?: string;
}) => {
  const message = createTeamsMessage({ id, title: text ? `${title}\n${text}` : title });
  await teamsConfig.axiosInstance.post('', message);
};

// 질문 답변용
const sendQuestionAnswer = async ({ text }: { text: string; teamsConversationId: string }) => {
  // 질문/답변만 전송
  const message = {
    text,
  };
  await teamsConfig.questionAxiosInstance.post('', message);
};

// 시그니처 검증 (타입별)
const verifyWebhookSignature = (
  req: Request & { rawBody?: Buffer },
  type: 'default' | 'question' = 'default'
): boolean => {
  let secret: Buffer;
  if (type === 'question') {
    if (!teamsConfig.questionWebhookSecret) {
      throw new Error('TEAMS_QUESTION_WEBHOOK_SECRET is not set');
    }
    secret = Buffer.from(teamsConfig.questionWebhookSecret, 'base64');
  } else {
    if (!teamsConfig.webhookSecret) {
      throw new Error('TEAMS_WEBHOOK_SECRET is not set');
    }
    secret = Buffer.from(teamsConfig.webhookSecret, 'base64');
  }
  const auth = req.headers['authorization'];
  if (!auth || !req.rawBody) {
    return false;
  }
  const msgHash =
    'HMAC ' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64');
  return msgHash === auth;
};

const isDuplicateMessage = (messageId: string): boolean => {
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  addProcessedMessageId(messageId);
  return false;
};

const extractPageIdFromText = (text: string): string | null => {
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
const processTeamsWebhook = async ({
  id: messageId,
  text,
}: {
  id: string;
  text: string;
}): Promise<void> => {
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
        content: `Implement fully functional TypeScript code that satisfies all requirements and flows described in the following software specification.\n- Do NOT write any HTML or CSS, only TypeScript code (functionality implementation).\n- The code should be a single TS file and must run without errors.\n- All methods and logic must be fully implemented and runnable.\n- Do NOT include any TODOs, comments like 'Implement ...', or unimplemented parts.\n- Do NOT leave any method or function body empty.\n- Do NOT include unnecessary comments, explanations, or examples.\n- Do NOT use class syntax. Write the code in functional (function-based) TypeScript only.\n- The code must not produce any TypeScript compile errors or warnings (no TS errors, no unused variables, etc).\n- The code must pass tsc (TypeScript compiler) with strict mode enabled.\n- Assume that any required DOM elements are either created in TypeScript or already exist.\n- Respond with BOTH a JSON code block and a TypeScript code block, in this order.\n- The JSON code block MUST contain the full feature specification as a JSON object, not an empty object.\n- Do NOT omit either block, even if you think one is redundant.\n\nRespond in the following format:\n\n\"\"\"json\n{...}\n\"\"\"\n\n\"\"\"typescript\n// complete code\n\"\"\"\n`,
      },
      {
        role: 'user',
        content: `Below is the software feature specification as a JSON object.\n\n${bodyText}`,
      },
    ],
    max_tokens: openaiConfig.maxTokens,
    temperature: openaiConfig.temperature,
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('OpenAI 응답이 비어있습니다.');
  }
  console.log('OpenAI 응답:', response);
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
  const codeMatch =
    response.match(/```typescript\s*([\s\S]*?)\s*```/i) ||
    response.match(/```ts\s*([\s\S]*?)\s*```/i) ||
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
  const pocBaseDir = path.join(process.cwd(), 'src/poc');
  const { folderPath, fileBase } = await getNextFolderAndFileName(pocBaseDir);
  await fs.mkdir(folderPath, { recursive: true });
  const jsonPath = path.join(folderPath, `${fileBase}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2));
  const tsPath = path.join(folderPath, `${fileBase}.ts`);
  await fs.writeFile(tsPath, code);

  // 5. Teams 알림 전송 (코드 생성/알림용 Webhook만)
  await sendNotification({
    id: pageId,
    title,
    url: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
  });

  console.log('Teams webhook 처리 완료:', { messageId, pageId });
};

export default {
  sendNotification,
  sendQuestionAnswer,
  verifyWebhookSignature,
  isDuplicateMessage,
  extractPageIdFromText,
  processTeamsWebhook,
};
