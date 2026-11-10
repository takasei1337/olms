const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

const app = require('./src/app');
const {startBackgroundWorkers} = require('./src/workers/background-worker');

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});

const workers = startBackgroundWorkers();

function shutdown() {
    workers.stop();
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
