require('dotenv').config()
const { URL } = require('url')

const url = process.argv[2] || `${process.env.SERVER_URL}/api/v1/log`
console.log(url)

const isValidUrl = (string) => {
    try {
        new URL(string.trim())
        return true
    } catch(error) {
        console.log(error)
        return false
    }
}

if (!isValidUrl(url)) {
    console.error('Error: The provided URL is invalid. Please provide a valid URL as an argument.')
    process.exit(1)
}

let requestCount = 0
let startTime = 0
let isRunning = false

const TARGET_RPS = 10000
const BATCH_INTERVAL_MS = 50 
const BATCH_SIZE = Math.ceil(TARGET_RPS / 20)

const sendSingleRequest = async () => {
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event_name: 'login'
            })
        })
        requestCount++
    } catch (error) {
        // Silent fail to maintain rate
    }
}



async function sendRequestBatch() {
    const promises = []
    for (let i = 0; i < BATCH_SIZE; i++) {
        promises.push(sendSingleRequest())
    }
    await Promise.allSettled(promises)
}

const logStatistics = () => {
    const currentTime = Date.now()
    const elapsedSeconds = (currentTime - startTime) / 1000
    const actualRPS = requestCount / elapsedSeconds
    
    console.log(`Actual requests/second: ${actualRPS.toFixed(2)}`)
    console.log(`Total requests sent: ${requestCount}`)
}

const startLoadGenerator = () => {
    if (isRunning) return
    
    isRunning = true
    startTime = Date.now()
    requestCount = 0
    
    console.log(`Starting load test targeting ${TARGET_RPS} requests per second`)
    console.log(`Sending requests to: ${url}`)
    console.log('Press Ctrl+C to stop')
    
    setInterval(sendRequestBatch, BATCH_INTERVAL_MS)
    
    setInterval(logStatistics, 1000)
}

startLoadGenerator()