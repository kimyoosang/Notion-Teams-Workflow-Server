// ====== 노션 페이지 본문 LLM(JSON) 변환 풀 사이클 테스트 코드 ======
if (require.main === module) {
  require('dotenv').config();
  const { Client } = require('@notionhq/client');
  const { OpenAI } = require('openai');

  const notion = new Client({
    auth: process.env.NOTION_API_KEY,
  });
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const testPageId = '1fc5a2fa-a754-8079-8e1f-ffb9ac24b700';

  (async () => {
    try {
      // 1. 노션 페이지 제목 가져오기
      const page = await notion.pages.retrieve({ page_id: testPageId });
      const title = page.properties.title?.title?.[0]?.plain_text || '제목 없음';
      console.log('노션 페이지 제목:', title);

      // 2. 노션 페이지 본문(블록) 전체 가져오기 (페이지네이션 지원)
      let bodyText = '';
      let cursor = undefined;
      do {
        const blocks = await notion.blocks.children.list({
          block_id: testPageId,
          start_cursor: cursor,
        });
        blocks.results.forEach(block => {
          if (block.type === 'paragraph') {
            bodyText += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
          }
        });
        cursor = blocks.has_more ? blocks.next_cursor : undefined;
      } while (cursor);
      console.log('노션 페이지 본문:', bodyText);

      // 3. LLM(OpenAI)로 JSON 변환 요청
      const prompt = `아래의 소프트웨어 기획/기능 문서 내용을 개발자가 바로 사용할 수 있도록 핵심 정보만 key-value 형태의 JSON으로 변환해줘. 반드시 JSON만 반환해. 설명이나 다른 텍스트는 필요 없어.\n\n문서 제목: ${title}\n문서 내용:\n${bodyText}\n\nJSON 예시:\n{\n  "기능명": "...",\n  "개요": "...",\n  "상세": "..."\n}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });

      let jsonResult;
      try {
        jsonResult = JSON.parse(response.choices[0].message.content);
      } catch (e) {
        console.log('LLM 응답(JSON 파싱 실패):', response.choices[0].message.content);
        throw e;
      }
      console.log('LLM이 변환한 JSON:', jsonResult);
    } catch (err) {
      console.error('노션 페이지 LLM 변환 실패:', err);
    }
  })();
}
