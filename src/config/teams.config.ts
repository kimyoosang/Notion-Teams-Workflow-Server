import axios from 'axios';

interface TeamsConfig {
  webhookUrl: string | undefined;
  webhookSecret: string | undefined;
  questionWebhookUrl: string | undefined;
  questionWebhookSecret: string | undefined;
  axiosInstance: ReturnType<typeof axios.create>;
  questionAxiosInstance: ReturnType<typeof axios.create>;
}

const teamsConfig: TeamsConfig = {
  webhookUrl: process.env.TEAMS_WEBHOOK_URL,
  webhookSecret: process.env.TEAMS_WEBHOOK_SECRET,
  questionWebhookUrl: process.env.TEAMS_QUESTION_WEBHOOK_URL,
  questionWebhookSecret: process.env.TEAMS_QUESTION_WEBHOOK_SECRET,
  axiosInstance: axios.create({
    baseURL: process.env.TEAMS_WEBHOOK_URL,
  }),
  questionAxiosInstance: axios.create({
    baseURL: process.env.TEAMS_QUESTION_WEBHOOK_URL,
  }),
};

export default teamsConfig;
