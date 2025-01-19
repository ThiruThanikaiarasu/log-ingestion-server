const logRecordModel = require("../models/logRecordModel")

const addRecordToDB = async (filename, requestCount) => {
    const newRecord = new logRecordModel(
        {
            requestCount,
            s3LogFileName: filename,
        }
    )
    console.log("Logs stored in db")
    await newRecord.save()
}

module.exports = {
    addRecordToDB
}