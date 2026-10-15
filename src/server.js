import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { Admin } from './models/Admin.js';
import { ROLES } from './constants/roles.js';

let server;

async function bootstrapAdmin() {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const { name, email, password } = env.INITIAL_ADMIN;
      const passwordHash = await Admin.hashPassword(password);

      await Admin.create({
        name,
        email,
        passwordHash,
        role: ROLES.SUPER_ADMIN
      });

      logger.info('=====================================================');
      logger.info(`Initial admin bootstrapped: ${email}`);
      logger.info('Please change the default password after initial login!');
      logger.info('=====================================================');
    }
  } catch (error) {
    logger.error('Error during initial admin bootstrap:', error.message);
  }
}

async function startServer() {
  try {
    // Connect to database
    await connectDB();

    // Ensure initial admin exists
    await bootstrapAdmin();

    // Start Express listener
    server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Hackathon Randomizer Backend running in [${env.NODE_ENV}] mode`);
      logger.info(`Listening on http://${env.HOST}:${env.PORT}`);
      logger.info(`API Health check: http://${env.HOST}:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force close after 10s timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise);
  logger.error('Reason:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

startServer();
