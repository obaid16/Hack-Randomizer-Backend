import { GenerationService } from '../services/generationService.js';
import { ExportService } from '../services/exportService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class GenerationController {
  /**
   * POST /api/v1/generations/preview
   */
  static preview = asyncHandler(async (req, res) => {
    const preview = await GenerationService.previewGeneration(req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Team generation preview calculated', preview);
  });

  /**
   * POST /api/v1/generations
   */
  static create = asyncHandler(async (req, res) => {
    const { generation, summary } = await GenerationService.createGeneration(req.body, req.admin._id);
    return ApiResponse.success(
      res,
      HTTP_STATUS.CREATED,
      'Teams generated and saved successfully',
      { generation, summary }
    );
  });

  /**
   * GET /api/v1/generations
   */
  static getAll = asyncHandler(async (req, res) => {
    const { generations, pagination } = await GenerationService.getGenerations(req.query);
    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Generations retrieved successfully',
      { generations },
      pagination
    );
  });

  /**
   * GET /api/v1/generations/:id
   */
  static getById = asyncHandler(async (req, res) => {
    const generation = await GenerationService.getGenerationById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Generation retrieved successfully', { generation });
  });

  /**
   * PATCH /api/v1/generations/:id/teams/:teamId
   */
  static updateTeam = asyncHandler(async (req, res) => {
    const updatedGen = await GenerationService.updateTeam(
      req.params.id,
      req.params.teamId,
      req.body
    );
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Team composition updated successfully', {
      generation: updatedGen
    });
  });

  /**
   * POST /api/v1/generations/:id/regenerate
   */
  static regenerate = asyncHandler(async (req, res) => {
    const result = await GenerationService.regenerate(
      req.params.id,
      req.body,
      req.admin._id
    );
    return ApiResponse.success(
      res,
      HTTP_STATUS.CREATED,
      'Teams regenerated successfully. Previous generation has been preserved.',
      result
    );
  });

  /**
   * GET /api/v1/generations/:id/export
   */
  static exportCsv = asyncHandler(async (req, res) => {
    const { csvContent, filename } = await ExportService.exportGenerationToCsv(req.params.id);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(HTTP_STATUS.OK).send(csvContent);
  });
}
