require('dotenv').config()
const express = require('express')
const app = express()

const logRoute = require('./routes/logRoute')
const { shutdown } = require('./services/logService')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1/log', logRoute)

app.get('/', (request, response) => {
    response.status(200).send({ message: "server running successfully"})
})

app.use((err, request, response, next) => {
    console.error('Unhandled error:', err)
    response.status(500).send({
        status: 'error',
        message: 'Internal server error'
    })
})

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Starting graceful shutdown...')
    try {
        await shutdown()
        process.exit(0)
    } catch (error) {
        console.error('Error during shutdown:', error)
        process.exit(1)
    }
})

process.on('SIGINT', async () => {
    console.log('SIGINT received. Starting graceful shutdown...')
    try {
        await shutdown()
        process.exit(0)
    } catch (error) {
        console.error('Error during shutdown:', error)
        process.exit(1)
    }
})


module.exports = app