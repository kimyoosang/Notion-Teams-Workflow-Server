const { Client } = require('@notionhq/client');
const { sendTeamsNotification } = require('./teams');

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function getNotionPageContent(pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  let title = page.properties.title?.title?.[0]?.plain_text || '제목 없음';
  let bodyText = '';
  let cursor = undefined;
  do {
    const blocks = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor });
    blocks.results.forEach(block => {
      if (
        block.type === 'paragraph' ||
        block.type === 'heading_1' ||
        block.type === 'heading_2' ||
        block.type === 'heading_3' ||
        block.type === 'bulleted_list_item' ||
        block.type === 'numbered_list_item'
      ) {
        bodyText += block[block.type].rich_text.map(t => t.plain_text).join('') + '\n';
      }
    });
    cursor = blocks.has_more ? blocks.next_cursor : undefined;
  } while (cursor);
  return { title, bodyText };
}

async function handleNotionWebhook(req, res) {
  try {
    const { type, payload } = req.body;

    if (type === 'page_updated') {
      const pageId = payload.page_id;
      const { title, bodyText } = await getNotionPageContent(pageId);
      console.log('노션 페이지 본문:', bodyText);
      await sendTeamsNotification({
        id: pageId,
        title,
        url: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Notion webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = {
  handleNotionWebhook,
  getNotionPageContent,
};
