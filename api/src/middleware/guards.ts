// Request guards that run before the routers (2026-11-26).
//
// sameOrigin: CSRF guard. The session cookie is SameSite=None in production (web and api are on different
//   *.up.railway.app sites), so a page on another site could make the browser send it with a hidden form POST
//   (for example to POST /admin/users/:id/ban, which needs no body). Browsers always send Origin on such
//   requests, so a state-changing request whose Origin (or Referer) is not the web app is refused.
//   Requests with neither header do not come from a web page (curl, server-to-server, tests) and carry no
//   victim's cookie, so they pass. Webhooks are called by Stripe / Bunny / the crypto provider and are skipped.
//
// throttle: per-user (or per-IP when signed out) limits on the write routes that are cheap to abuse:
//   sending chat messages, starting a checkout or uploading a slip, and admin image uploads.
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { hit } from '../lib/rate-limit.js';
import { SESSION_COOKIE } from './auth.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const WEBHOOKS = /^\/(stripe\/webhook|crypto\/webhook|bunny\/webhook)(\/|$)/;
const WEB_ORIGIN = new URL(config.WEB_URL).origin;

function originOf(v: string | undefined): string | null {
  if (!v) return null;
  try {
    return new URL(v).origin;
  } catch {
    return 'invalid';
  }
}

export function sameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || WEBHOOKS.test(req.path)) return next();
  const from = originOf(req.get('origin')) ?? originOf(req.get('referer'));
  if (from === null || from === WEB_ORIGIN) return next();
  next(new AppError('FORBIDDEN', 403, 'Request refused: it did not come from this site'));
}

const MIN = 60 * 1000;
const RULES: { name: string; path: RegExp; limit: number; windowMs: number }[] = [
  { name: 'chat', path: /^\/(me\/threads\/support|courses\/[^/]+\/threads|threads\/[^/]+\/messages)$/, limit: 20, windowMs: MIN },
  { name: 'checkout', path: /^\/(courses\/[^/]+\/checkout(\/bank-transfer)?|orders\/[^/]+\/slip)$/, limit: 10, windowMs: 10 * MIN },
  { name: 'upload', path: /^\/(admin\/(uploads|partners\/[^/]+\/logo)|instructor\/(uploads|profile\/documents)|auth\/register-instructor)$/, limit: 60, windowMs: 10 * MIN },
];

/** Who is calling, without a DB hit: the session's user id when the cookie is valid, else the IP. */
function caller(req: Request): string {
  const token = req.cookies?.[SESSION_COOKIE] ?? (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '');
  if (token) {
    try {
      const p = jwt.verify(token, config.JWT_SECRET) as { sub?: string };
      if (p.sub) return `u:${p.sub}`;
    } catch {
      /* fall back to IP */
    }
  }
  return `ip:${req.ip ?? '?'}`;
}

export function throttle(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();
  const rule = RULES.find((r) => r.path.test(req.path));
  if (!rule) return next();
  if (hit(`${rule.name}:${caller(req)}`, rule.limit, rule.windowMs)) return next();
  next(new AppError('TOO_MANY_REQUESTS', 429, 'You are doing that too often. Please wait a moment and try again.'));
}
