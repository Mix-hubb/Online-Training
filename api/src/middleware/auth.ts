// Auth middleware: cookie JWT -> req.user. The user is loaded from the DB on EVERY request,
// so a ban or role change takes effect at once (spec section 4: banned users are rejected on every request).
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE = 'ot_session';
const SESSION_DAYS = 7;

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN || undefined,
    maxAge: SESSION_DAYS * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN || undefined,
    path: '/',
  });
}

function readToken(req: Request): string | null {
  const c = req.cookies?.[SESSION_COOKIE];
  if (c) return c;
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function loadUser(req: Request) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub?: string };
    if (!payload.sub) return null;
    return await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

/** Paths a user with mustChangePassword may still call. */
const MUST_CHANGE_ALLOWED = new Set(['/auth/me', '/auth/change-password', '/auth/logout']);

/** Sets req.user when a valid, not-banned session exists. Never fails. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await loadUser(req);
  if (user && user.status !== 'BANNED') req.user = user;
  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await loadUser(req);
    if (!user) throw new AppError('UNAUTHENTICATED', 401);
    if (user.status === 'BANNED') throw new AppError('BANNED', 403);
    if (user.mustChangePassword && !MUST_CHANGE_ALLOWED.has(req.originalUrl.split('?')[0])) {
      throw new AppError('MUST_CHANGE_PASSWORD', 403);
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new AppError('FORBIDDEN', 403));
  next();
}

/** Learning routes: partners only see their portal. */
export function requireLearner(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role === 'PARTNER') return next(new AppError('FORBIDDEN', 403));
  next();
}

export function me(req: Request) {
  if (!req.user) throw new AppError('UNAUTHENTICATED', 401);
  return req.user;
}
