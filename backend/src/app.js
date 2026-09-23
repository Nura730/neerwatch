const express = require('express');
const cors    = require('cors');
const healthRouter = require('./routes/health');
const apiRouter    = require('./routes/index');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Allow the deployed frontend origin. In production set FRONTEND_URL to the
// deployed frontend's origin. Comma-separate multiple origins if needed.
// Falls back to common local dev ports when FRONTEND_URL is not set.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use('/health', healthRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

module.exports = app;
