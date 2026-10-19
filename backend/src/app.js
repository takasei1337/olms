const express = require('express');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes/api.routes');
const requestContext = require('./middlewares/request-context');

const app = express();

app.use(express.json());
app.use(requestContext);

app.use(healthRoutes);
app.use('/api/v1', apiRoutes);


module.exports = app;