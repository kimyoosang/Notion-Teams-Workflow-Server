const { Client } = require('@notionhq/client');

const notionClient = new Client({
  auth: process.env.NOTION_API_KEY,
});

module.exports = notionClient;
