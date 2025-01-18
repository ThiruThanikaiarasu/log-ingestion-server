const EventEmitter = require('events')
const { BATCH_SIZE, FLUSH_INTERVAL } = require("../configuration/constants")
const { uploadFileToS3 } = require('./s3Service')

const bufferEmitter = new EventEmitter()

// Shared state
let messageBuffer = []
let bufferSize = 0
let lastFlushTime = Date.now()
let isProcessing = false
let flushInterval = null
const MAX_RETRIES = 3

const sendMessageToBuffer = async (message) => {
    if (!message) {
        throw new Error('Message cannot be undefined or empty')
    }

    try {
        const formattedMessage = {
            unix_timestamp: Math.floor(Date.now() / 1000),
            data: message
        }

        const messageStr = JSON.stringify(formattedMessage)
        messageBuffer.push(messageStr)
        bufferSize += Buffer.byteLength(messageStr, 'utf8')
        
        bufferEmitter.emit('messageReceived', messageStr)

        if (bufferSize >= BATCH_SIZE) {
            await flushToS3()
        }

        const now = Date.now()
        if (now - lastFlushTime >= FLUSH_INTERVAL) {
            await flushToS3()
        }

        return true
    } catch (error) {
        console.error('Error processing message:', error)
        throw new Error(`Failed to process message: ${error.message}`)
    }
}

const startProcessing = () => {
    if (flushInterval) {
        return
    }

    flushInterval = setInterval(async () => {
        const now = Date.now()
        if (now - lastFlushTime >= FLUSH_INTERVAL && messageBuffer.length > 0) {
            await flushToS3()
        }
    }, 5000)

    bufferEmitter.emit('started')
}

const getFilename = () => {
    const date = new Date()
    return `logs/${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}/${Date.now()}.log`
}

const flushToS3 = async (retryCount = 0) => {
    if (messageBuffer.length === 0 || isProcessing) {
        return
    }

    isProcessing = true
    const currentBuffer = [...messageBuffer]
    const currentSize = bufferSize

    try {
        const data = currentBuffer.join('\n')
        const filename = getFilename()

        await uploadFileToS3(filename, data)
        
        // Only clear the processed messages if they haven't been modified
        if (bufferSize === currentSize && 
            JSON.stringify(messageBuffer) === JSON.stringify(currentBuffer)) {
            messageBuffer = []
            bufferSize = 0
        }
        
        lastFlushTime = Date.now()
        bufferEmitter.emit('flushed', filename)
    } catch (error) {
        console.error('Error flushing to S3:', error)
        
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying flush attempt ${retryCount + 1} of ${MAX_RETRIES}`)
            setTimeout(() => {
                flushToS3(retryCount + 1)
            }, Math.pow(2, retryCount) * 1000) // Exponential backoff
        } else {
            bufferEmitter.emit('flushError', error)
            throw new Error(`Failed to flush to S3 after ${MAX_RETRIES} attempts: ${error.message}`)
        }
    } finally {
        isProcessing = false
    }
}

const shutdown = async () => {
    try {
        if (flushInterval) {
            clearInterval(flushInterval)
            flushInterval = null
        }

        if (messageBuffer.length > 0) {
            await flushToS3()
        }

        bufferEmitter.emit('shutdown')
        return true
    } catch (error) {
        console.error('Error during shutdown:', error)
        throw new Error(`Failed to shutdown properly: ${error.message}`)
    }
}

const getBufferStatus = () => {
    return {
        messageCount: messageBuffer.length,
        bufferSize: bufferSize,
        lastFlushTime: lastFlushTime,
        isProcessing: isProcessing
    }
}

// Event listener setup helper
const on = (eventName, listener) => {
    bufferEmitter.on(eventName, listener)
}

module.exports = {
    sendMessageToBuffer,
    startProcessing,
    shutdown,
    getBufferStatus,
    on
}