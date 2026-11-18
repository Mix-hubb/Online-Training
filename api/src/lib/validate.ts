// Zod helpers: parse body/query; ZodError becomes VALIDATION_FAILED in error-handler.
import type { Request } from 'express';
import { z, type ZodTypeAny } from 'zod';

export const body = <T extends ZodTypeAny>(req: Request, schema: T): z.infer<T> => schema.parse(req.body ?? {});
export const query = <T extends ZodTypeAny>(req: Request, schema: T): z.infer<T> => schema.parse(req.query ?? {});

export const email = z.string().trim().toLowerCase().email().max(200);
export const password = z.string().min(8, 'Password must be at least 8 characters').max(200);
