require('dotenv').config()
const loadtest = require('loadtest')

const inputURL = process.argv[2] || `${process.env.SERVER_URL}/api/v1/log`
const inputRequests = process.argv[3] || 1000

const isValidUrl = (string) => {
    try {
        new URL(string)
        return true
    } catch {
        return false
    }
}

const isValidNumber = (value) => {
    const number = Number(value)
    return !isNaN(number) && number > 0
}

if (!isValidUrl(inputURL)) {
    console.error('Error: The provided URL is invalid. Please provide a valid URL.')
    process.exit(1)
}

if (!isValidNumber(inputRequests)) {
    console.error('Error: The number of requests must be a positive integer.')
    process.exit(1)
}

console.log(process.env.SERVER_URL)
const options = {
    url: inputURL,
    maxRequests: Number(inputRequests),
    method: 'POST',
    body: JSON.stringify({
        event_name: 'login'
    }),
    contentType: 'application/json',
    headers: {
        'Content-Type': 'application/json'
    },
    maxSeconds: 60, 
}

loadtest.loadTest(options, (error, result) => {
    if (error) {
        console.error('Load test failed:', error)
    } else {
        console.log('Load test completed:', result)
    }
})