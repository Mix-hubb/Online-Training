// Auth routes (all roles, PARTNER included). Spec sections 3, 4, 15.9.
//   POST /auth/register            { name, email, password } -> verify email sent
//   POST /auth/verify-email        { token }
//   POST /auth/resend-verification { email }
//   POST /auth/login               { email, password }
//   POST /auth/google              { credential }  (Google ID token)
//   POST /auth/forgot-password     { email }  (always 200, no account enumeration)
//   POST /auth/reset-password      { token, password }  (clears mustChangePassword)
//   GET  /auth/me
//   POST /auth/logout
//   POST /auth/change-password     { currentPassword, newPassword }  (clears mustChangePassword)
// Email (Resend, src/mail.ts): verify link (24 h), reset link (1 h, single use), "password changed" notice.
// Rate limits (in memory, lib/rate-limit.ts), 429 TOO_MANY_REQUESTS:
//   login: 10 failed tries per email and 50 per IP in 15 min
//   register: 10 per IP per hour; forgot-password / resend-verification: 20 per IP per hour
//   and at most 3 mails per email address in 15 min (extra requests answer 200 but send nothing)
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '@prisma/client';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, email, password } from '../../lib/validate.js';
import { randomToken, sha256 } from '../../lib/tokens.js';
import { sendMailSafe, verifyEmailMail, resetPasswordMail, passwordChangedMail } from '../../mail.js';
import { clear, hit, isLimited } from '../../lib/rate-limit.js';
import { requireAuth, setSessionCookie, clearSessionCookie } from '../../middleware/auth.js';

export const authRouter = Router();

const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 3600 * 1000;
const MIN15 = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const tooMany = () => new AppError('TOO_MANY_REQUESTS', 429, 'Too many attempts. Please wait a few minutes and try again.');
/** Per-IP limit: throws 429. */
function limitIp(name: string, ip: string | undefined, limit: number, windowMs: number) {
  if (!hit(`${name}:ip:${ip ?? '?'}`, limit, windowMs)) throw tooMany();
}
/** Per-address mail limit: false means "do not send", the response stays the same (no account enumeration). */
const mailAllowed = (to: string) => hit(`mail:${to}`, 3, MIN15);

export async function toMe(user: User) {
  const [partner, profile] = await Promise.all([
    prisma.partner.findUnique({ where: { userId: user.id }, select: { id: true, name: true } }),
    user.role === 'INSTRUCTOR' ? prisma.instructorProfile.findUnique({ where: { userId: user.id }, select: { status: true } }) : null,
  ]);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    mustChangePassword: user.mustChangePassword,
    hasPassword: Boolean(user.passwordHash),
    partner,
    // 2026-11-27: PENDING / REJECTED instructors only see their application page.
    instructorStatus: profile?.status ?? null,
  };
}

async function issueToken(userId: string, type: 'VERIFY' | 'RESET') {
  const token = randomToken();
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + (type === 'VERIFY' ? VERIFY_TTL_MS : RESET_TTL_MS)),
    },
  });
  return token;
}

async function useToken(token: string, type: 'VERIFY' | 'RESET') {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    throw new AppError('VALIDATION_FAILED', 400, 'This link is invalid or has expired');
  }
  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row;
}

/** New verify link; older unused verify links stop working. Returns false when the mail could not be sent. */
export async function sendVerify(user: User) {
  await prisma.authToken.updateMany({ where: { userId: user.id, type: 'VERIFY', usedAt: null }, data: { usedAt: new Date() } });
  const token = await issueToken(user.id, 'VERIFY');
  return sendMailSafe(verifyEmailMail(user.email, `${config.WEB_URL}/verify-email?token=${token}`));
}

authRouter.post(
  '/register',
  h(async (req, res) => {
    limitIp('register', req.ip, 10, HOUR);
    const input = body(req, z.object({ name: z.string().trim().min(1).max(100), email, password }));
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError('VALIDATION_FAILED', 409, 'An account with this email already exists');
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 10) },
    });
    mailAllowed(user.email);
    // If the mail fails, the account still exists; the learner can use "Send the link again".
    const mailSent = await sendVerify(user);
    res.status(201).json({ ok: true, email: user.email, mailSent });
  }),
);

authRouter.post(
  '/verify-email',
  h(async (req, res) => {
    const { token } = body(req, z.object({ token: z.string().min(10) }));
    const row = await useToken(token, 'VERIFY');
    const user = await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    if (user.status === 'BANNED') throw new AppError('BANNED', 403);
    setSessionCookie(res, user.id);
    res.json({ user: await toMe(user) });
  }),
);

authRouter.post(
  '/resend-verification',
  h(async (req, res) => {
    limitIp('resend', req.ip, 20, HOUR);
    const input = body(req, z.object({ email }));
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user && !user.emailVerifiedAt && user.status === 'ACTIVE' && mailAllowed(user.email)) await sendVerify(user);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/login',
  h(async (req, res) => {
    const input = body(req, z.object({ email, password: z.string().min(1).max(200) }));
    const emailKey = `login:email:${input.email}`;
    const ipKey = `login:ip:${req.ip ?? '?'}`;
    if (isLimited(emailKey, 10) || isLimited(ipKey, 50)) throw tooMany();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const ok = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !ok) {
      hit(emailKey, 10, MIN15);
      hit(ipKey, 50, MIN15);
      throw new AppError('UNAUTHENTICATED', 401, 'Wrong email or password');
    }
    clear(emailKey);
    if (user.status === 'BANNED') throw new AppError('BANNED', 403);
    if (!user.emailVerifiedAt) throw new AppError('EMAIL_NOT_VERIFIED', 403);
    setSessionCookie(res, user.id);
    res.json({ user: await toMe(user) });
  }),
);

const googleClient = new OAuth2Client();

authRouter.post(
  '/google',
  h(async (req, res) => {
    if (!config.GOOGLE_CLIENT_ID) throw new AppError('VALIDATION_FAILED', 400, 'Google sign-in is not set up');
    const { credential } = body(req, z.object({ credential: z.string().min(10) }));
    const ticket = await googleClient
      .verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID })
      .catch(() => {
        throw new AppError('UNAUTHENTICATED', 401, 'Google sign-in failed');
      });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new AppError('UNAUTHENTICATED', 401, 'Google sign-in failed');
    const mail = p.email.toLowerCase();
    let user = await prisma.user.findFirst({ where: { OR: [{ googleId: p.sub }, { email: mail }] } });
    if (user) {
      if (user.status === 'BANNED') throw new AppError('BANNED', 403);
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: p.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), avatarUrl: user.avatarUrl ?? p.picture },
      });
    } else {
      user = await prisma.user.create({
        data: { email: mail, name: p.name ?? mail.split('@')[0], googleId: p.sub, avatarUrl: p.picture, emailVerifiedAt: new Date() },
      });
    }
    setSessionCookie(res, user.id);
    res.json({ user: await toMe(user) });
  }),
);

authRouter.post(
  '/forgot-password',
  h(async (req, res) => {
    limitIp('forgot', req.ip, 20, HOUR);
    const input = body(req, z.object({ email }));
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user && user.status === 'ACTIVE' && mailAllowed(user.email)) {
      const token = await issueToken(user.id, 'RESET');
      await sendMailSafe(resetPasswordMail(user.email, `${config.WEB_URL}/reset-password?token=${token}`));
    }
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/reset-password',
  h(async (req, res) => {
    const input = body(req, z.object({ token: z.string().min(10), password }));
    const row = await useToken(input.token, 'RESET');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
    const user = await prisma.user.update({
      where: { id: row.userId },
      // The password is now the user's own, so the forced change is no longer needed.
      // Opening the emailed link also proves the mailbox, so the email counts as verified.
      data: {
        passwordHash: await bcrypt.hash(input.password, 10),
        mustChangePassword: false,
        emailVerifiedAt: before.emailVerifiedAt ?? new Date(),
      },
    });
    // Invalidate other open reset links.
    await prisma.authToken.updateMany({ where: { userId: user.id, type: 'RESET', usedAt: null }, data: { usedAt: new Date() } });
    clear(`login:email:${user.email}`);
    await sendMailSafe(passwordChangedMail(user.email));
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    res.json({ user: await toMe(req.user!) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post(
  '/change-password',
  requireAuth,
  h(async (req, res) => {
    const input = body(req, z.object({ currentPassword: z.string().max(200).optional(), newPassword: password }));
    const user = req.user!;
    if (user.passwordHash) {
      const ok = input.currentPassword ? await bcrypt.compare(input.currentPassword, user.passwordHash) : false;
      if (!ok) throw new AppError('VALIDATION_FAILED', 400, 'Current password is wrong');
      if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
        throw new AppError('VALIDATION_FAILED', 400, 'Choose a new password that is different from the current one');
      }
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 10), mustChangePassword: false },
    });
    // Not for the first change of an admin-issued temporary password: that one was never the user's own.
    if (!user.mustChangePassword) await sendMailSafe(passwordChangedMail(updated.email));
    res.json({ user: await toMe(updated) });
  }),
);
