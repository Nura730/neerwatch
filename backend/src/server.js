require('dotenv').config();
const app      = require('./app');
const { connectDatabase } = require('./config/database');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;

// Fail fast if authentication cannot be configured
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET environment variable is not set');
  process.exit(1);
}

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`NEERWATCH backend listening on port ${PORT}`);
  });

  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down gracefully`);

    // Stop accepting new connections; wait for in-flight requests to finish.
    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      } catch (err) {
        console.error('Error closing MongoDB connection:', err.message);
        process.exit(1);
      }
    });

    // Force exit after 15 s if graceful shutdown stalls (e.g., keep-alive connections).
    setTimeout(() => {
      console.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 15000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
