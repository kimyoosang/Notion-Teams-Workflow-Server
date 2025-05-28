import notionClient from '../config/notion.config';
import openaiConfig from '../config/openai.config';

const extractTextFromBlock = (block: any): string => {
  if (
    block.type === 'paragraph' ||
    block.type === 'heading_1' ||
    block.type === 'heading_2' ||
    block.type === 'heading_3' ||
    block.type === 'bulleted_list_item' ||
    block.type === 'numbered_list_item' ||
    block.type === 'to_do' ||
    block.type === 'toggle' ||
    block.type === 'code'
  ) {
    return block[block.type].rich_text.map((t: any) => t.plain_text).join('') + '\n';
  }
  return '';
};

const getPageContent = async (pageId: string): Promise<{ title: string; bodyText: string }> => {
  const page = (await notionClient.pages.retrieve({ page_id: pageId })) as any;
  let title = page.properties.title?.title?.[0]?.plain_text || '제목 없음';

  // 모든 블록(자식 포함) 재귀적으로 파싱
  const getAllBlocks = async (blockId: string) => {
    let blocks: any[] = [];
    let cursor = undefined;
    do {
      const res = await notionClient.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      blocks = blocks.concat(res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
    } while (cursor);
    return blocks;
  };

  const parseBlocks = async (blocks: any[]) => {
    let text = '';
    for (const block of blocks) {
      text += extractTextFromBlock(block);
      if (block.has_children) {
        const children = await getAllBlocks(block.id);
        text += await parseBlocks(children);
      }
    }
    return text;
  };

  const topBlocks = await getAllBlocks(pageId);
  const bodyText = await parseBlocks(topBlocks);
  console.log('bodyText: ', bodyText);
  return { title, bodyText };
};

const answerQuestionToTeams = async (question: string): Promise<string> => {
  const pageId = '2005a2faa7548022a17cfcb4b09e8b55'; // 고정
  const { title, bodyText } = await getPageContent(pageId);
  const openai = openaiConfig.client;
  const prompt = `아래 Notion 페이지 내용을 참고해서, 반드시 문서 내에서 근거를 찾아서 답변해.\n문서에 없는 정보는 반드시 '문서 내에 해당 정보가 없습니다'라고 답해.\n질문과 문서 내 표현이 다르더라도, 의미가 같으면 답변해.\n예를 들어, '와이파이'와 'wifi'는 같은 의미다.\n문서에 표, 리스트, 코드블록이 있으면 그 내용도 참고해서 답변해.\n\n예시:\nQ: 우리 와이파이 정보 알려줘\nA: wifi: metsakuur_13F\npassword: 20200101\n...\n\nNotion Page Title: ${title}\n\nNotion Page Content:\n${bodyText}\n\nQuestion: ${question}\n\nAnswer:`;
  const completion = await openai.chat.completions.create({
    model: openaiConfig.model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });
  const answer = completion.choices[0]?.message?.content?.trim() || '';
  return answer;
};

export default {
  getPageContent,
  answerQuestionToTeams,
};
