// Express 4 does not catch rejected promises: wrap async handlers with h().
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
