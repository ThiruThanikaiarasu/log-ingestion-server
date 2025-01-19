const express = require('express')
const router = express.Router()

const { sendMessage } = require('../controllers/logController')
const { validateLogRequestBody } = require('../middleware/validateRequestBody')


router.post(
    '/', 

    validateLogRequestBody,

    sendMessage
)

module.exports = router