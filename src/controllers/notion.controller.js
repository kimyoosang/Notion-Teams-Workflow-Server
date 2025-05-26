const notionService = require('../services/notion.service');
const teamsService = require('../services/teams.service');

const handleWebhook = async (req, res) => {
  try {
    const { pageId } = req.body;
    if (!pageId) {
      return res.status(400).json({ error: 'Page ID is required' });
    }

    const { title, bodyText } = await notionService.getPageContent(pageId);
    res.status(200).json({ title, bodyText });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  handleWebhook,
};
