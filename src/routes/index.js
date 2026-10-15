import { Router } from 'express';
import authRoutes from './authRoutes.js';
import studentRoutes from './studentRoutes.js';
import mentorRoutes from './mentorRoutes.js';
import generationRoutes from './generationRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const router = Router();

// API Health Check
router.get('/health', (req, res) => {
  return ApiResponse.success(res, HTTP_STATUS.OK, 'Hackathon Team Randomizer API is operational', {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/mentors', mentorRoutes);
router.use('/generations', generationRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
