// Zod schemas.
import { z } from 'zod';

export const progressBody = z.object({
  position: z.number().min(0).max(24 * 3600),
  watchedDelta: z.number().min(0).max(3600),
});
