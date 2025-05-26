const teamsConfig = require('../config/teams.config');
const crypto = require('crypto');

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
          {
            type: 'ActionSet',
            actions: [
              {
                type: 'Action.Submit',
                title: '수락',
                data: {
                  action: 'approve',
                  pageId: id,
                },
              },
            ],
          },
        ],
      },
    },
  ],
});

const sendNotification = async ({ id, title, url }) => {
  const message = createTeamsMessage({ id, title });
  await teamsConfig.axiosInstance.post('', message);
};

const verifyWebhookSignature = req => {
  const bufSecret = Buffer.from(teamsConfig.webhookSecret, 'base64');
  const auth = req.headers['authorization'];
  const msgHash =
    'HMAC ' + crypto.createHmac('sha256', bufSecret).update(req.rawBody).digest('base64');
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

module.exports = {
  sendNotification,
  verifyWebhookSignature,
  isDuplicateMessage,
  extractPageIdFromText,
};
