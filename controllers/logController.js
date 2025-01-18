const { sendMessageToBuffer } = require("../services/logService")
const { setResponseBody } = require("../utils/responseFormatter")

const sendMessage = async (request, response) => {
    try {
        const message = request.body
        await sendMessageToBuffer(message)
        response.status(200).send(setResponseBody("Log message received successfully", null, null))
    } catch (error) {
        console.error('Error processing log message:', error)
        response.status(500).send(setResponseBody("Failed to process log message", "server_error", null))
    }
}

module.exports = {
    sendMessage
}