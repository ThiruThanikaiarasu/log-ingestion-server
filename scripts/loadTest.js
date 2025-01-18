require('dotenv').config()
const loadtest = require('loadtest')

const maxRequests = process.argv[2] || 1000

console.log(process.env.SERVER_URL)
const options = {
    url: `${process.env.SERVER_URL}/api/v1/log`,
    maxRequests,
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