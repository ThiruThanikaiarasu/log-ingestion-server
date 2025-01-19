require('dotenv').config()
const { GetObjectCommand } = require('@aws-sdk/client-s3')
const logRecordModel = require('../models/logRecordModel')
const s3 = require('../configuration/s3Config')
const connectToDatabase = require('../database/connection')

async function getFileFromS3(filename) {
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: filename
    }

    try {
        const { Body } = await s3.send(new GetObjectCommand(params))
        const fileContent = await streamToString(Body)
        console.log(`✓ Successfully retrieved ${filename} from S3`)
        return fileContent
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            throw new Error(`File ${filename} not found in S3 bucket`)
        }
        throw new Error(`Failed to fetch from S3: ${error.message}`)
    }
}

function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = []
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        stream.on('error', reject)
    })
}

async function getLogRecords(limit) {
    const logs = await logRecordModel.find()
        .sort({ createdAt: -1 })
        .limit(limit)

    if (!logs || logs.length === 0) {
        throw new Error('No logs found in the database')
    }

    return logs
}

async function verifyLogFile(logRecord, index) {
    console.log(`\n📋 Verifying Log ${index + 1}:`)
    console.log('  Filename:', logRecord.s3LogFileName)
    console.log('  Recorded Request Count:', logRecord.requestCount)
    console.log('  Timestamp:', logRecord.createdAt)

    try {
        const logContent = await getFileFromS3(logRecord.s3LogFileName)
        const logLines = logContent.trim().split('\n')
        const actualLogCount = logLines.length
        console.log('\n──────────────────────────────')
        console.log('\nResults:')
        console.log('  Expected Requests :', logRecord.requestCount)
        console.log('  Actual Log Lines  :', actualLogCount)
        
        const difference = Math.abs(actualLogCount - logRecord.requestCount)
        
        if (actualLogCount === logRecord.requestCount) {
            console.log('  ✅ Log count matches request count exactly')
            return { success: true, difference: 0 }
        } else {
            console.log('  ⚠️  Mismatch detected:')
            console.log(`  Difference of ${difference} ${difference === 1 ? 'entry' : 'entries'}`)
            
            console.log('\n  Sample log entries:')
            const sampleSize = Math.min(3, logLines.length)
            for (let i = 0; i < sampleSize; i++) {
                try {
                    const parsed = JSON.parse(logLines[i])
                    console.log(`    ${i + 1}. Timestamp: ${parsed.unix_timestamp}, Worker: ${parsed.worker_id}`)
                } catch (e) {
                    console.log(`    ${i + 1}. Raw: ${logLines[i].substring(0, 100)}...`)
                }
            }
            return { success: false, difference }
        }
    } catch (error) {
        console.log('  ❌ Error:', error.message)
        return { success: false, error: error.message }
    }
}

async function verifyLogs() {
    let exitCode = 0
    const requestedCount = parseInt(process.argv[2]) || 2

    console.log('\n🔍 Starting log verification...')
    console.log('────────────────────────────')

    if (isNaN(requestedCount) || requestedCount < 1) {
        console.error('Please provide a valid positive number of logs to verify')
        console.log('Usage: npm run test-log <number>')
        process.exit(1)
    }

    try {
        console.log('Connecting to database...')
        await connectToDatabase()
        console.log('✓ Database connected')
        console.log('\n────────────────────────────')

        const logs = await getLogRecords(requestedCount)
        
        if (logs.length < requestedCount) {
            console.log(`\n⚠️  Note: Only ${logs.length} log${logs.length === 1 ? ' record' : ' records'} found in database (requested ${requestedCount})`)
        }

        let summary = {
            total: logs.length,
            matched: 0,
            mismatched: 0,
            errors: 0
        }

        for (let i = 0; i < logs.length; i++) {
            const result = await verifyLogFile(logs[i], i)
            
            if (result.success) {
                summary.matched++
            } else if (result.error) {
                summary.errors++
                exitCode = 1
            } else {
                summary.mismatched++
                exitCode = 1
            }
        }

        console.log('\n────────────────────────────────────────')
        console.log('\n📊 Final Summary:')
        console.log(`   Total Logs Checked : ${summary.total}`)
        console.log(`   Matched            : ${summary.matched}`)
        console.log(`   Mismatched         : ${summary.mismatched}`)
        console.log(`   Errors             : ${summary.errors}`)

    } catch (error) {
        console.error('\n❌ ERROR:', error.message)
        exitCode = 1
    } finally {
        console.log('\n────────────────────────────────────────')
        console.log('Verification completed at:', new Date().toISOString())
        process.exit(exitCode)
    }
}

process.on('unhandledRejection', (error) => {
    console.error('\n Unhandled Promise Rejection:', error)
    process.exit(1)
})

verifyLogs()