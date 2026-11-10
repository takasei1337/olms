const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

const app = require('./src/app');

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});
