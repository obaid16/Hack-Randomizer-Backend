import { Router } from 'express';
import { MentorController } from '../controllers/mentorController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { uploadCsv } from '../middleware/uploadMiddleware.js';
import {
  createMentorSchema,
  updateMentorSchema,
  mentorQuerySchema
} from '../validators/mentorValidator.js';

const router = Router();

// Protect all mentor routes with admin authentication
router.use(authenticate);

router.get('/', validate(mentorQuerySchema, 'query'), MentorController.getMentors);
router.post('/', validate(createMentorSchema), MentorController.createMentor);
router.post('/bulk', uploadCsv.single('file'), MentorController.bulkImport);
router.get('/:id', MentorController.getMentorById);
router.patch('/:id', validate(updateMentorSchema), MentorController.updateMentor);
router.delete('/:id', MentorController.deleteMentor);

export default router;
