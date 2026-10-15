import { z } from 'zod';
import { VALID_STATUSES } from '../constants/status.js';

export const createMentorSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name cannot exceed 120 characters'),
  mentorId: z
    .string({ required_error: 'Mentor ID is required' })
    .trim()
    .min(2, 'Mentor ID must be at least 2 characters')
    .max(50, 'Mentor ID cannot exceed 50 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .or(z.literal('')),
  expertise: z
    .array(z.string().trim())
    .or(z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)))
    .optional()
    .default([]),
  status: z.enum(VALID_STATUSES).optional().default('ACTIVE')
});

export const updateMentorSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  mentorId: z.string().trim().min(2).max(50).optional(),
  email: z.string().email('Invalid email address').trim().toLowerCase().optional().nullable().or(z.literal('')),
  expertise: z
    .array(z.string().trim())
    .or(z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)))
    .optional(),
  status: z.enum(VALID_STATUSES).optional()
});

export const bulkMentorsSchema = z.object({
  mentors: z
    .array(
      z.object({
        fullName: z.string({ required_error: 'Full name is required' }).trim().min(2),
        mentorId: z.string({ required_error: 'Mentor ID is required' }).trim().min(2),
        email: z.string().email().trim().toLowerCase().optional().nullable().or(z.literal('')),
        expertise: z.union([z.array(z.string()), z.string()]).optional(),
        status: z.enum(VALID_STATUSES).optional()
      })
    )
    .min(1, 'At least one mentor must be provided in bulk import')
});

export const mentorQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z.string().optional().transform(v => (v ? Math.min(200, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  search: z.string().trim().optional(),
  status: z.enum(VALID_STATUSES).optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});
