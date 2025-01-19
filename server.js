const cluster = require('cluster')
const numCPUs = require('os').cpus().length
const app = require('./app')
const { startBufferProcessing } = require('./services/bufferService')
const { shutdown, on } = require('./services/logService')
const connectToDatabase = require('./database/connection')

const PORT = process.env.PORT || 3000

if (cluster.isMaster) {
    console.log(`Master process ${process.pid} is running`)

    startBufferProcessing()
    
    on('flushed', (filename) => {
        console.log(`Master: Logs flushed to ${filename}`)
    })

    on('flushError', (error) => {
        console.error('Master: Error flushing logs:', error)
    })

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork()
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`)
        cluster.fork()
    })

    connectToDatabase()
        .then(() => {
            console.log(`Master process ${process.pid} connected to database`)

            process.on('SIGINT', async () => {
                console.log('Master shutting down...')
                for (const id in cluster.workers) {
                    cluster.workers[id].send('shutdown')
                }
                await mongoose.disconnect()
                process.exit(0)
            })
        })
        .catch((error) => {
            console.error(`Master process ${process.pid} failed to connect to database: ${error}`)
            process.exit(1)
        })

    process.on('SIGTERM', async () => {
        console.log('Master received SIGTERM. Starting graceful shutdown...')
        
        for (const id in cluster.workers) {
            cluster.workers[id].send('shutdown')
        }

        try {
            await shutdown()
            console.log('Buffer service shut down successfully')
        } catch (error) {
            console.error('Error shutting down buffer service:', error)
        }

        process.exit(0)
    })

    process.on('SIGINT', async () => {
        console.log('Master received SIGINT. Starting graceful shutdown...')
        
        for (const id in cluster.workers) {
            cluster.workers[id].send('shutdown')
        }

        try {
            await shutdown()
            console.log('Buffer service shut down successfully')
        } catch (error) {
            console.error('Error shutting down buffer service:', error)
        }

        process.exit(0)
    })

} else {
    console.log(`Worker ${process.pid} started`)

    process.on('message', async (msg) => {
        if (msg === 'shutdown') {
            console.log(`Worker ${process.pid} received shutdown message`)
            server.close(() => {
                console.log(`Worker ${process.pid} closed`)
                process.exit(0)
            })
        }
    })

    const server = app.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`)
    })

}