const mongoose = require('mongoose')

const logRecordSchema = new mongoose.Schema(
    {
        requestCount: {
            type: Number,
            required: [true, "Request count is a mandatory field"]
        },
        s3LogFileName: {
            type: String, 
            required: [true, "S3 Log filename is a mandatory field"],
            unique: true,
        }
    },
    {
        timestamps: true,
        collection: 'logRecords'
    }
)

module.exports = mongoose.model.logRecords || mongoose.model('logRecords', logRecordSchema)