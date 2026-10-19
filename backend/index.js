require('dotenv').config({quiet: true});

const app = require('./src/app');

const port = 3000;

app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});
