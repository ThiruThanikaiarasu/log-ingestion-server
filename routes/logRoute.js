const express = require('express')
const { sendMessage } = require('../controllers/logController')
const router = express.Router()
// const { sendMessage, getBufferStatus } = require('../services/bufferService')

router.post(
    '/', 

    sendMessage
)

module.exports = router