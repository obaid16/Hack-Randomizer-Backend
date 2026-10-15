import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Admin } from '../src/models/Admin.js';
import { ROLES } from '../src/constants/roles.js';
import { AuthService } from '../src/services/authService.js';

let mongoServer;

export async function setupTestDB() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_1234567890_antigravity';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri);
  return uri;
}

export async function teardownTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export async function createTestAdmin(customEmail = null) {
  const email = customEmail || `admin.test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@college.edu`;
  const passwordHash = await Admin.hashPassword('Admin123456!');
  const admin = await Admin.create({
    name: 'Test SuperAdmin',
    email,
    passwordHash,
    role: ROLES.SUPER_ADMIN
  });

  const token = AuthService.generateToken(admin);
  return { admin, token, email };
}
