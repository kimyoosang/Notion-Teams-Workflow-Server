import { Request, Response } from 'express';
import teamsService from '../services/teams.service';

const handleWebhook = async (req: Request, res: Response): Promise<void> => {
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

    // 4. 실제 비즈니스 로직은 서비스에 위임
    await teamsService.processTeamsWebhook(req.body);
  } catch (error) {
    console.error('Teams webhook 처리 중 에러 발생:', error);
  }
};

export default {
  handleWebhook,
};
