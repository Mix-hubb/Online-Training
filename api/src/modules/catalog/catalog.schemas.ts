// Zod schemas for catalog query params.
import { z } from 'zod';

export const courseListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(100).optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  price: z.enum(['free', 'paid']).optional(),
  tag: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
export type CourseListQuery = z.infer<typeof courseListQuery>;
