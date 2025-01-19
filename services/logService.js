const EventEmitter = require('events')
const cluster = require('cluster')
const fs = require('fs').promises
const path = require('path')

const { BATCH_SIZE, FLUSH_INTERVAL, LOCAL_BACKUP_DIR, FAILED_UPLOADS_CHECK_INTERVAL } = require("../configuration/constants")
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
let failedUploadsInterval = null
const MAX_RETRIES = 3

const ensureBackupDirectory = async () => {
    try {
        await fs.mkdir(LOCAL_BACKUP_DIR, { recursive: true })
    } catch (error) {
        console.error('Error creating backup directory:', error)
        throw error
    }
}

const saveToLocalFile = async (filename, data) => {
    try {
        const localFilePath = path.join(LOCAL_BACKUP_DIR, path.basename(filename))
        await fs.writeFile(localFilePath, data)
        console.log(`Backup saved to local file: ${localFilePath}`)
        bufferEmitter.emit('localBackupCreated', localFilePath)
        return localFilePath
    } catch (error) {
        console.error('Error saving to local file:', error)
        throw error
    }
}

const processFailedUploads = async () => {
    try {
        const files = await fs.readdir(LOCAL_BACKUP_DIR)
        
        for (const file of files) {
            const filePath = path.join(LOCAL_BACKUP_DIR, file)
            const data = await fs.readFile(filePath, 'utf8')
            
            try {
                const s3Path = `logs/${file}`
                await uploadFileToS3(s3Path, data)
                await addRecordToDB(s3Path, 0) 
                await fs.unlink(filePath)
                bufferEmitter.emit('failedUploadProcessed', s3Path)
            } catch (error) {
                console.error(`Failed to process backup file ${file}:`, error)
                bufferEmitter.emit('failedUploadError', { file, error })
                continue
            }
        }
    } catch (error) {
        console.error('Error processing failed uploads:', error)
    }
}

const startFailedUploadsCheck = () => {
    if (failedUploadsInterval || !cluster.isMaster) {
        return
    }

    failedUploadsInterval = setInterval(processFailedUploads, FAILED_UPLOADS_CHECK_INTERVAL)
}

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
    const filename = getFilename()

    try {
        const data = currentBuffer.join('\n')
        
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
            try {
                const data = currentBuffer.join('\n')
                await ensureBackupDirectory()
                const localPath = await saveToLocalFile(filename, data)
                console.log(`Buffer saved to local backup: ${localPath}`)
                
                if (bufferSize === currentSize && 
                    JSON.stringify(messageBuffer) === JSON.stringify(currentBuffer)) {
                    messageBuffer = []
                    bufferSize = 0
                    requestCount = 0
                    workerRequests.clear()
                }
            } catch (backupError) {
                console.error('Failed to create local backup:', backupError)
                bufferEmitter.emit('flushError', error)
                throw new Error(`Failed to flush to S3 and local backup: ${error.message}`)
            }
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

const startProcessing = async () => {
    if (flushInterval || !cluster.isMaster) {
        return
    }

    try {
        await ensureBackupDirectory()
    } catch (error) {
        console.error('Failed to create backup directory:', error)
        throw error
    }

    if (cluster.isMaster) {
        cluster.on('message', (worker, msg) => {
            if (msg.type === 'bufferMessage') {
                messageBuffer.push(msg.message)
                bufferSize += Buffer.byteLength(msg.message, 'utf8')
                
                bufferEmitter.emit('messageReceived', msg.message)

                const currentCount = workerRequests.get(worker.id) || 0
                workerRequests.set(worker.id, currentCount + msg.workerRequestCount)
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

    startFailedUploadsCheck()
    bufferEmitter.emit('started')
}

const shutdown = async () => {
    try {
        if (flushInterval) {
            clearInterval(flushInterval)
            flushInterval = null
        }

        if (failedUploadsInterval) {
            clearInterval(failedUploadsInterval)
            failedUploadsInterval = null
        }

        if (cluster.isMaster && messageBuffer.length > 0) {
            await flushToS3()
        }

        if (cluster.isMaster) {
            await processFailedUploads()
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