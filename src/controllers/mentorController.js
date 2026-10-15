import { MentorService } from '../services/mentorService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ApiError } from '../utils/apiError.js';

export class MentorController {
  /**
   * POST /api/v1/mentors
   */
  static createMentor = asyncHandler(async (req, res) => {
    const mentor = await MentorService.createMentor(req.body);
    return ApiResponse.success(res, HTTP_STATUS.CREATED, 'Mentor created successfully', { mentor });
  });

  /**
   * GET /api/v1/mentors
   */
  static getMentors = asyncHandler(async (req, res) => {
    const { mentors, pagination } = await MentorService.getMentors(req.query);
    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Mentors retrieved successfully',
      { mentors },
      pagination
    );
  });

  /**
   * GET /api/v1/mentors/:id
   */
  static getMentorById = asyncHandler(async (req, res) => {
    const mentor = await MentorService.getMentorById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Mentor retrieved successfully', { mentor });
  });

  /**
   * PATCH /api/v1/mentors/:id
   */
  static updateMentor = asyncHandler(async (req, res) => {
    const mentor = await MentorService.updateMentor(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Mentor updated successfully', { mentor });
  });

  /**
   * DELETE /api/v1/mentors/:id
   */
  static deleteMentor = asyncHandler(async (req, res) => {
    const result = await MentorService.deleteMentor(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, result);
  });

  /**
   * POST /api/v1/mentors/bulk
   */
  static bulkImport = asyncHandler(async (req, res) => {
    let result;

    if (req.file) {
      result = await MentorService.bulkImportCsv(req.file.buffer);
    } else if (req.body && Array.isArray(req.body.mentors)) {
      result = await MentorService.bulkImport(req.body.mentors);
    } else if (Array.isArray(req.body)) {
      result = await MentorService.bulkImport(req.body);
    } else {
      throw ApiError.badRequest('Please upload a CSV file or provide an array of mentors in JSON format.');
    }

    const message = `Bulk import completed: ${result.successCount} imported successfully, ${result.failedCount} failed.`;
    return ApiResponse.success(res, HTTP_STATUS.OK, message, result);
  });
}
