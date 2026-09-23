const express = require('express');
const healthRouter = require('./routes/health');
const apiRouter = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

app.use('/health', healthRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

module.exports = app;
