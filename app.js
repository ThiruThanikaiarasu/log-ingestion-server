require('dotenv').config()
const express = require('express')
const app = express()

app.get('/', (request, response) => {
    response.status(200).send({ message: "server running successfully"})
})

app.listen(3500, console.log('Server running at http://localhost:3500'))