require('dotenv').config();
const app = require('./app');
const { connectDatabase } = require('./config/database');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Starting server without database connection — some endpoints will be unavailable.');
  }

  app.listen(PORT, () => {
    console.log(`NEERWATCH backend listening on port ${PORT}`);
  });
}

start();
