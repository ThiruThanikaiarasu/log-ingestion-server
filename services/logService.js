const EventEmitter = require('events')
const cluster = require('cluster')

const { BATCH_SIZE, FLUSH_INTERVAL } = require("../configuration/constants")
const { uploadFileToS3 } = require("./s3Service")
const { addRecordToDB } = require('../repositories/logRepository')


const bufferEmitter = new EventEmitter()

let messageBuffer = []
let bufferSize = 0
let requestCount = 0
let workerRequests = new Map()
let lastFlushTime = Date.now()
let isProcessing = false
let flushInterval = null
const MAX_RETRIES = 3

const sendMessageToMaster = (message) => {
    if (cluster.isWorker) {
        process.send(
            { 
                type: 'bufferMessage', 
                message,
                workerRequestCount: 1 
            }
        )
        return true
    }
    return false
}

const getFilename = () => {
    const date = new Date()
    return `logs/${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}/${Date.now()}.log`
}

const getTotalRequestCount = () => {
    const workerTotal = Array.from(workerRequests.values()).reduce((sum, count) => sum + count, 0)
    return requestCount + workerTotal
}

const flushToS3 = async (retryCount = 0) => {
    if (messageBuffer.length === 0 || isProcessing || !cluster.isMaster) {
        return
    }

    isProcessing = true
    const currentBuffer = [...messageBuffer]
    const currentSize = bufferSize

    try {
        const data = currentBuffer.join('\n')
        const filename = getFilename()

        await uploadFileToS3(filename, data)
        await addRecordToDB(filename, getTotalRequestCount())
        
        if (bufferSize === currentSize && 
            JSON.stringify(messageBuffer) === JSON.stringify(currentBuffer)) {
            messageBuffer = []
            bufferSize = 0
            requestCount = 0  
            workerRequests.clear()
        }
        
        lastFlushTime = Date.now()
        bufferEmitter.emit('flushed', filename)
    } catch (error) {
        console.error('Error flushing to S3:', error)
        
        if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
                flushToS3(retryCount + 1)
            }, Math.pow(2, retryCount) * 1000)
        } else {
            bufferEmitter.emit('flushError', error)
            throw new Error(`Failed to flush to S3 after ${MAX_RETRIES} attempts: ${error.message}`)
        }
    } finally {
        isProcessing = false
    }
}

const sendMessageToBuffer = async (message) => {
    if (!message) {
        throw new Error('Message cannot be undefined or empty')
    }

    try {
        const formattedMessage = {
            unix_timestamp: Math.floor(Date.now() / 1000),
            data: message,
            worker_id: cluster.isWorker ? cluster.worker.id : 'master'
        }

        const messageStr = JSON.stringify(formattedMessage)

        if (cluster.isWorker) {
            return sendMessageToMaster(messageStr)
        }

        messageBuffer.push(messageStr)
        bufferSize += Buffer.byteLength(messageStr, 'utf8')
        requestCount++
        
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
    if (flushInterval || !cluster.isMaster) {
        return
    }

    if (cluster.isMaster) {
        cluster.on('message', (worker, msg) => {
            if (msg.type === 'bufferMessage') {
                messageBuffer.push(msg.message)
                bufferSize += Buffer.byteLength(msg.message, 'utf8')
                
                bufferEmitter.emit('messageReceived', msg.message)

                const currentCount = workerRequests.get(worker.id) || 0
                workerRequests.set(worker.id, currentCount + msg.workerRequestCount)
                
                bufferEmitter.emit('messageReceived', msg.message)
            }
        })

        cluster.on('disconnect', (worker) => {
            workerRequests.delete(worker.id)
        })
    }

    flushInterval = setInterval(async () => {
        const now = Date.now()
        if (now - lastFlushTime >= FLUSH_INTERVAL && messageBuffer.length > 0) {
            await flushToS3()
        }
    }, 5000)

    bufferEmitter.emit('started')
}

const shutdown = async () => {
    try {
        if (flushInterval) {
            clearInterval(flushInterval)
            flushInterval = null
        }

        if (cluster.isMaster && messageBuffer.length > 0) {
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
    if (!cluster.isMaster) {
        return null
    }
    
    return {
        messageCount: messageBuffer.length,
        bufferSize: bufferSize,
        totalRequests: getTotalRequestCount(),
        workerRequests: Object.fromEntries(workerRequests),
        masterRequests: requestCount,
        lastFlushTime: lastFlushTime,
        isProcessing: isProcessing
    }
}

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