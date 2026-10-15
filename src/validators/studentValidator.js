import { z } from 'zod';
import { VALID_ACADEMIC_YEARS } from '../constants/academicYears.js';
import { VALID_STATUSES } from '../constants/status.js';

export const createStudentSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(120, 'Full name cannot exceed 120 characters'),
  studentId: z
    .string({ required_error: 'Student ID is required' })
    .trim()
    .min(2, 'Student ID must be at least 2 characters')
    .max(50, 'Student ID cannot exceed 50 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .or(z.literal('')),
  academicYear: z.enum(VALID_ACADEMIC_YEARS, {
    errorMap: () => ({ message: 'Academic year must be FIRST_YEAR or SECOND_YEAR' })
  }),
  department: z.string().trim().max(100).optional().default(''),
  skills: z
    .array(z.string().trim())
    .or(z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)))
    .optional()
    .default([]),
  status: z.enum(VALID_STATUSES).optional().default('ACTIVE')
});

export const updateStudentSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  studentId: z.string().trim().min(2).max(50).optional(),
  email: z.string().email('Invalid email address').trim().toLowerCase().optional().nullable().or(z.literal('')),
  academicYear: z.enum(VALID_ACADEMIC_YEARS).optional(),
  department: z.string().trim().max(100).optional(),
  skills: z
    .array(z.string().trim())
    .or(z.string().transform(val => val.split(',').map(s => s.trim()).filter(Boolean)))
    .optional(),
  status: z.enum(VALID_STATUSES).optional()
});

export const bulkStudentsSchema = z.object({
  students: z
    .array(
      z.object({
        fullName: z.string({ required_error: 'Full name is required' }).trim().min(2),
        studentId: z.string({ required_error: 'Student ID is required' }).trim().min(2),
        email: z.string().email().trim().toLowerCase().optional().nullable().or(z.literal('')),
        academicYear: z.enum(VALID_ACADEMIC_YEARS, {
          errorMap: () => ({ message: 'Must be FIRST_YEAR or SECOND_YEAR' })
        }),
        department: z.string().trim().optional(),
        skills: z.union([z.array(z.string()), z.string()]).optional(),
        status: z.enum(VALID_STATUSES).optional()
      })
    )
    .min(1, 'At least one student must be provided in bulk import')
});

export const studentQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z.string().optional().transform(v => (v ? Math.min(200, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  search: z.string().trim().optional(),
  academicYear: z.enum(VALID_ACADEMIC_YEARS).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  department: z.string().trim().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});
