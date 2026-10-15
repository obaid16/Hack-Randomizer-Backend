import { Router } from 'express';
import { StudentController } from '../controllers/studentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { uploadCsv } from '../middleware/uploadMiddleware.js';
import {
  createStudentSchema,
  updateStudentSchema,
  studentQuerySchema
} from '../validators/studentValidator.js';

const router = Router();

// Protect all student routes with admin authentication
router.use(authenticate);

router.get('/', validate(studentQuerySchema, 'query'), StudentController.getStudents);
router.post('/', validate(createStudentSchema), StudentController.createStudent);
router.post('/bulk', uploadCsv.single('file'), StudentController.bulkImport);
router.get('/:id', StudentController.getStudentById);
router.patch('/:id', validate(updateStudentSchema), StudentController.updateStudent);
router.delete('/:id', StudentController.deleteStudent);

export default router;
