const axios = require('axios');

const teamsConfig = {
  webhookUrl: process.env.TEAMS_WEBHOOK_URL,
  webhookSecret: process.env.TEAMS_WEBHOOK_SECRET,
  axiosInstance: axios.create({
    baseURL: process.env.TEAMS_WEBHOOK_URL,
  }),
};

module.exports = teamsConfig;
