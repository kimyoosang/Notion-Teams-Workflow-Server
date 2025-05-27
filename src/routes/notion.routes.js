const express = require('express');
const router = express.Router();
const notionController = require('../controllers/notion.controller');

router.post('/', notionController.answerQuestion);

module.exports = router;
