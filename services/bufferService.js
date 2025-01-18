const { startProcessing } = require("./logService")

const startBufferProcessing = async () => {
    try {
        await startProcessing()
        console.log('Buffer processing started successfully')
    } catch (error) {
        console.error('Failed to start buffer processing:', error)
        process.exit(1)
    }
}

module.exports = {
    startBufferProcessing
}