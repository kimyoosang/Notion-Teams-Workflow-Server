const { OpenAI } = require('openai');

const openaiConfig = {
  client: new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  }),
  model: 'gpt-3.5-turbo',
  maxTokens: 2000,
  temperature: 0.7,
};

module.exports = openaiConfig;
