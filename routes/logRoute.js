const express = require('express')
const router = express.Router()

const { sendMessage } = require('../controllers/logController')


router.post(
    '/', 

    sendMessage
)

module.exports = router