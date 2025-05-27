const notionService = require('../services/notion.service');

const answerQuestion = async (req, res) => {
  try {
    // HTML 태그 제거 및 멘션/공백 정리
    let question = req.body.text || '';
    question = question
      .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // &nbsp; 제거
      .replace(/@[^ ]+/, '') // 멘션 제거 (예: @질문하기)
      .replace(/\s+/g, ' ') // 연속 공백 하나로
      .trim();

    if (!question) {
      return res.status(400).json({ error: '질문이 필요합니다.' });
    }
    // answerQuestionToTeams가 답변만 반환
    const answer = await notionService.answerQuestionToTeams(question);
    res.status(200).json({
      type: 'message',
      text: `Q: ${question}\n\nA: ${answer}`,
    });
  } catch (error) {
    console.error('Notion 질문 답변 처리 중 에러:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  answerQuestion,
};
