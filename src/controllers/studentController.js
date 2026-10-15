import { StudentService } from '../services/studentService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ApiError } from '../utils/apiError.js';

export class StudentController {
  /**
   * POST /api/v1/students
   */
  static createStudent = asyncHandler(async (req, res) => {
    const student = await StudentService.createStudent(req.body);
    return ApiResponse.success(res, HTTP_STATUS.CREATED, 'Student created successfully', { student });
  });

  /**
   * GET /api/v1/students
   */
  static getStudents = asyncHandler(async (req, res) => {
    const { students, pagination } = await StudentService.getStudents(req.query);
    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Students retrieved successfully',
      { students },
      pagination
    );
  });

  /**
   * GET /api/v1/students/:id
   */
  static getStudentById = asyncHandler(async (req, res) => {
    const student = await StudentService.getStudentById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Student retrieved successfully', { student });
  });

  /**
   * PATCH /api/v1/students/:id
   */
  static updateStudent = asyncHandler(async (req, res) => {
    const student = await StudentService.updateStudent(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Student updated successfully', { student });
  });

  /**
   * DELETE /api/v1/students/:id
   */
  static deleteStudent = asyncHandler(async (req, res) => {
    const result = await StudentService.deleteStudent(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, result.message, result);
  });

  /**
   * POST /api/v1/students/bulk
   * Supports either CSV file upload (multipart/form-data with field 'file')
   * OR JSON payload with { students: [...] }
   */
  static bulkImport = asyncHandler(async (req, res) => {
    let result;

    if (req.file) {
      // CSV File uploaded
      result = await StudentService.bulkImportCsv(req.file.buffer);
    } else if (req.body && Array.isArray(req.body.students)) {
      // JSON array
      result = await StudentService.bulkImport(req.body.students);
    } else if (Array.isArray(req.body)) {
      // Direct JSON array
      result = await StudentService.bulkImport(req.body);
    } else {
      throw ApiError.badRequest('Please upload a CSV file or provide an array of students in JSON format.');
    }

    const message = `Bulk import completed: ${result.successCount} imported successfully, ${result.failedCount} failed.`;
    return ApiResponse.success(res, HTTP_STATUS.OK, message, result);
  });
}
