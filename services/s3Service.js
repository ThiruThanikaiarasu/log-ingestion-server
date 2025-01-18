const { PutObjectCommand } = require("@aws-sdk/client-s3")
const s3 = require("../configuration/s3Config")

const uploadFileToS3 = async (filename, data) => {
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: filename,
        Body: data,
        ContentType: 'text/plain',
        ACL: 'bucket-owner-full-control'
    }

    try {
        await s3.send(new PutObjectCommand(params))
        console.log(`Successfully uploaded ${filename} to S3`)
    } catch(error) {
        console.error('S3 upload error:', error)
        throw error
    }
}

module.exports = {
    uploadFileToS3
}