const notionClient = require('../config/notion.config');

const extractTextFromBlock = block => {
  if (
    block.type === 'paragraph' ||
    block.type === 'heading_1' ||
    block.type === 'heading_2' ||
    block.type === 'heading_3' ||
    block.type === 'bulleted_list_item' ||
    block.type === 'numbered_list_item'
  ) {
    return block[block.type].rich_text.map(t => t.plain_text).join('') + '\n';
  }
  return '';
};

const getPageContent = async pageId => {
  const page = await notionClient.pages.retrieve({ page_id: pageId });
  let title = page.properties.title?.title?.[0]?.plain_text || '제목 없음';
  let bodyText = '';
  let cursor = undefined;

  do {
    const blocks = await notionClient.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
    });

    bodyText += blocks.results.map(extractTextFromBlock).join('');
    cursor = blocks.has_more ? blocks.next_cursor : undefined;
  } while (cursor);

  return { title, bodyText };
};

module.exports = {
  getPageContent,
};
