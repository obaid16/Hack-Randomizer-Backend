import { DashboardService } from '../services/dashboardService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class DashboardController {
  /**
   * GET /api/v1/dashboard/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const stats = await DashboardService.getStats();
    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Dashboard statistics retrieved successfully',
      stats
    );
  });
}
