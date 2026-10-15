import { Router } from 'express';
import { GenerationController } from '../controllers/generationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  generationPreviewSchema,
  generationCreateSchema,
  generationQuerySchema,
  teamEditSchema,
  regenerateSchema
} from '../validators/generationValidator.js';

const router = Router();

// Protect all generation routes with admin authentication
router.use(authenticate);

router.post('/preview', validate(generationPreviewSchema), GenerationController.preview);
router.post('/', validate(generationCreateSchema), GenerationController.create);
router.get('/', validate(generationQuerySchema, 'query'), GenerationController.getAll);
router.get('/:id', GenerationController.getById);
router.patch('/:id/teams/:teamId', validate(teamEditSchema), GenerationController.updateTeam);
router.post('/:id/regenerate', validate(regenerateSchema), GenerationController.regenerate);
router.get('/:id/export', GenerationController.exportCsv);

export default router;
