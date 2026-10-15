import { connectDB, disconnectDB } from '../config/db.js';
import { Admin } from '../models/Admin.js';
import { env } from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import { logger } from '../utils/logger.js';

async function seedAdmin() {
  try {
    await connectDB();

    const { name, email, password } = env.INITIAL_ADMIN;
    const existing = await Admin.findOne({ email });

    if (existing) {
      logger.info(`Admin with email '${email}' already exists. Updating password...`);
      existing.passwordHash = await Admin.hashPassword(password);
      existing.name = name;
      existing.role = ROLES.SUPER_ADMIN;
      await existing.save();
      logger.info(`Admin account '${email}' updated successfully.`);
    } else {
      const passwordHash = await Admin.hashPassword(password);
      await Admin.create({
        name,
        email,
        passwordHash,
        role: ROLES.SUPER_ADMIN
      });
      logger.info(`Admin account '${email}' created successfully.`);
    }

    logger.info('=============================================');
    logger.info('Admin Credentials:');
    logger.info(`Email: ${email}`);
    logger.info(`Password: ${password}`);
    logger.info('Role: SUPER_ADMIN');
    logger.info('=============================================');
  } catch (error) {
    logger.error('Failed to seed admin:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seedAdmin();
