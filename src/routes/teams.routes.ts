import express from 'express';
import teamsController from '../controllers/teams.controller';

const router = express.Router();

router.post('/webhook', teamsController.handleWebhook);

export default router;
