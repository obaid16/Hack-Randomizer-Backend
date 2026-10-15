import { AuthService } from '../services/authService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { token, admin } = await AuthService.login(email, password);

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return ApiResponse.success(res, HTTP_STATUS.OK, 'Authentication successful', {
      token,
      admin
    });
  });

  /**
   * POST /api/v1/auth/logout
   */
  static logout = asyncHandler(async (req, res) => {
    res.clearCookie('token');
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Logged out successfully', {});
  });

  /**
   * GET /api/v1/auth/me
   */
  static me = asyncHandler(async (req, res) => {
    const admin = await AuthService.getAdminById(req.admin._id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Profile retrieved successfully', { admin });
  });

  /**
   * POST /api/v1/auth/change-password
   */
  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(req.admin._id, currentPassword, newPassword);
    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, {});
  });
}
