import { z } from 'zod';

export const generationPreviewSchema = z.object({
  requestedTeamCount: z
    .number()
    .int('Team count must be an integer')
    .positive('Team count must be greater than 0')
    .optional()
    .nullable(),
  balancedMentorDistribution: z.boolean().optional().default(true),
  excludeAssignedStudents: z.boolean().optional().default(false),
  selectedGenerationId: z.string().trim().optional().nullable()
});

export const generationCreateSchema = z.object({
  generationName: z
    .string({ required_error: 'Generation name is required' })
    .trim()
    .min(2, 'Generation name must be at least 2 characters')
    .max(100, 'Generation name cannot exceed 100 characters'),
  requestedTeamCount: z
    .number()
    .int('Team count must be an integer')
    .positive('Team count must be greater than 0')
    .optional()
    .nullable(),
  balancedMentorDistribution: z.boolean().optional().default(true),
  excludeAssignedStudents: z.boolean().optional().default(false),
  selectedGenerationId: z.string().trim().optional().nullable(),
  teamNamePrefix: z.string().trim().max(30).optional().default('Team')
});

export const teamEditSchema = z.object({
  firstYearStudentIds: z
    .array(z.string().trim().min(1, 'Student ID or ObjectId required'))
    .length(2, 'Exactly 2 first-year student references must be provided'),
  secondYearStudentId: z
    .string({ required_error: 'Second-year student reference is required' })
    .trim()
    .min(1, 'Second-year student ID or ObjectId required'),
  mentorId: z
    .string({ required_error: 'Mentor reference is required' })
    .trim()
    .min(1, 'Mentor ID or ObjectId required'),
  teamName: z.string().trim().min(1).max(50).optional()
});

export const regenerateSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Regeneration requires explicit confirmation (confirm: true)' })
  }),
  generationName: z.string().trim().min(2).max(100).optional(),
  requestedTeamCount: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
  balancedMentorDistribution: z.boolean().optional(),
  excludeAssignedStudents: z.boolean().optional()
});

export const generationQuerySchema = z.object({
  page: z.string().optional().transform(v => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  limit: z.string().optional().transform(v => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 10)) : 10)),
  status: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});
