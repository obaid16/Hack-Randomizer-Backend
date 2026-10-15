import jwt from 'jsonwebtoken';
import { Admin } from '../models/Admin.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

export class AuthService {
  /**
   * Authenticate admin with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ token: string, admin: object }>}
   */
  static async login(email, password) {
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!admin) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const token = this.generateToken(admin);
    const adminObj = admin.toJSON();

    return { token, admin: adminObj };
  }

  /**
   * Change admin password
   * @param {string} adminId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  static async changePassword(adminId, currentPassword, newPassword) {
    const admin = await Admin.findById(adminId).select('+passwordHash');
    if (!admin) {
      throw ApiError.notFound('Admin account not found.');
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Incorrect current password.');
    }

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from the current password.');
    }

    admin.passwordHash = await Admin.hashPassword(newPassword);
    await admin.save();

    return { message: 'Password updated successfully.' };
  }

  /**
   * Get admin profile by ID
   * @param {string} adminId
   */
  static async getAdminById(adminId) {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw ApiError.notFound('Admin not found.');
    }
    return admin.toJSON();
  }

  /**
   * Generate JWT token for admin
   * @param {import('../models/Admin.js').Admin} admin
   */
  static generateToken(admin) {
    return jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }
}
