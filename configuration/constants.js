const path = require('path')

const BATCH_SIZE = 10 * 1024 * 1024
const FLUSH_INTERVAL = 60000
const LOCAL_BACKUP_DIR = path.join(process.cwd(), 'backup_logs')
const FAILED_UPLOADS_CHECK_INTERVAL = 5 * 60 * 1000 

module.exports = {
    BATCH_SIZE,
    FLUSH_INTERVAL,
    LOCAL_BACKUP_DIR,
    FAILED_UPLOADS_CHECK_INTERVAL
}