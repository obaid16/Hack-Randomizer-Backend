import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Protect dashboard stats with admin authentication
router.use(authenticate);

router.get('/stats', DashboardController.getStats);

export default router;
