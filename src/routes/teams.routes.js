const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teams.controller');

router.post('/webhook', teamsController.handleWebhook);

module.exports = router;
