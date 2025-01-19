const { setResponseBody } = require("../utils/responseFormatter")

const validateLogRequestBody = (request, response, next) => {

    request.isValid = Boolean(request.body?.event_name)

    if(!request.isValid) {
        return response.status(400).send(setResponseBody("Invalid request body, event_name field is required.", "validation_error", null))
    }

    next()
}

module.exports = {
    validateLogRequestBody
}