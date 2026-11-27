// Instructor sign-up and own profile (2026-11-27).
//   POST   /auth/register-instructor   (public) { name, email, password, phone, headline, bio, expertise[], documents: [{ title, isPublic, file }] }
//          -> INSTRUCTOR account + PENDING profile; verify-email mail sent. Login works after the email is verified;
//             the instructor tools stay closed until an admin approves (INSTRUCTOR_NOT_APPROVED).
//   GET    /instructor/profile                       own profile, status, reject reason, documents (short-lived links)
//   PUT    /instructor/profile  { phone, headline, bio, expertise }   a REJECTED application goes back to PENDING
//   POST   /instructor/profile/documents  { title, isPublic, file }
//   PATCH  /instructor/profile/documents/:id  { title?, isPublic? }
//   DELETE /instructor/profile/documents/:id   (an application keeps at least one document)
// The /instructor/profile routes work in every status (mounted before the approval guard).
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { h } from '../../lib/async.js';
import { AppError } from '../../lib/errors.js';
import { body, email, password } from '../../lib/validate.js';
import { hit } from '../../lib/rate-limit.js';
import { writeAudit } from '../../lib/audit.js';
import { storage } from '../../providers/storage/index.js';
import { sendVerify } from '../auth/auth.routes.js';
import { documentInput, loadProfile, MAX_DOCS, profileFields, profileView, storeDocuments } from './profile.service.js';

export const instructorSignupRouter = Router();
export const instructorProfileRouter = Router();

instructorSignupRouter.post(
  '/auth/register-instructor',
  h(async (req, res) => {
    if (!hit(`register:ip:${req.ip ?? '?'}`, 10, 3600_000)) throw new AppError('TOO_MANY_REQUESTS', 429, 'Too many attempts. Please wait and try again.');
    const input = body(
      req,
      profileFields.extend({
        name: z.string().trim().min(1).max(100),
        email,
        password,
        documents: z.array(documentInput).min(1, 'Upload at least one document').max(MAX_DOCS),
      }),
    );
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw new AppError('VALIDATION_FAILED', 409, 'An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const userId = (await prisma.user.create({ data: { name: input.name, email: input.email, passwordHash, role: 'INSTRUCTOR', status: 'ACTIVE' } })).id;
    try {
      const docs = await storeDocuments(userId, input.documents);
      await prisma.instructorProfile.create({
        data: {
          userId,
          phone: input.phone,
          headline: input.headline,
          bio: input.bio,
          expertise: input.expertise,
          documents: { create: docs.map(({ userId: _u, ...d }) => d) },
        },
      });
    } catch (e) {
      await prisma.user.delete({ where: { id: userId } }); // nothing half-made is left behind
      throw e;
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const mailSent = await sendVerify(user);
    res.status(201).json({ ok: true, email: user.email, mailSent });
  }),
);

instructorProfileRouter.get('/profile', h(async (req, res) => res.json(await profileView(await loadProfile(req.user!.id)))));

instructorProfileRouter.put(
  '/profile',
  h(async (req, res) => {
    const input = body(req, profileFields);
    const before = await loadProfile(req.user!.id);
    const resubmit = before.status === 'REJECTED';
    await prisma.instructorProfile.update({
      where: { userId: before.userId },
      data: { ...input, ...(resubmit ? { status: 'PENDING', submittedAt: new Date(), rejectReason: null } : {}) },
    });
    await writeAudit(req.user!.id, resubmit ? 'instructor.resubmit' : 'instructor.profile_update', 'InstructorProfile', before.userId);
    res.json(await profileView(await loadProfile(before.userId)));
  }),
);

instructorProfileRouter.post(
  '/profile/documents',
  h(async (req, res) => {
    const input = body(req, documentInput);
    const p = await loadProfile(req.user!.id);
    if (p.documents.length >= MAX_DOCS) throw new AppError('VALIDATION_FAILED', 400, `At most ${MAX_DOCS} documents`);
    const [row] = await storeDocuments(p.userId, [input]);
    await prisma.instructorDocument.create({ data: row });
    res.status(201).json(await profileView(await loadProfile(p.userId)));
  }),
);

async function ownDoc(userId: string, id: string) {
  const d = await prisma.instructorDocument.findUnique({ where: { id } });
  if (!d || d.userId !== userId) throw new AppError('NOT_FOUND', 404);
  return d;
}

instructorProfileRouter.patch(
  '/profile/documents/:id',
  h(async (req, res) => {
    const input = body(req, z.object({ title: z.string().trim().min(1).max(120).optional(), isPublic: z.boolean().optional() }));
    const d = await ownDoc(req.user!.id, req.params.id);
    await prisma.instructorDocument.update({ where: { id: d.id }, data: input });
    res.json(await profileView(await loadProfile(d.userId)));
  }),
);

instructorProfileRouter.delete(
  '/profile/documents/:id',
  h(async (req, res) => {
    const d = await ownDoc(req.user!.id, req.params.id);
    const p = await loadProfile(d.userId);
    if (p.status !== 'APPROVED' && p.documents.length <= 1) throw new AppError('VALIDATION_FAILED', 400, 'Keep at least one document for the review');
    await prisma.instructorDocument.delete({ where: { id: d.id } });
    await storage.delete(d.storageKey, 'private').catch(() => undefined);
    res.json(await profileView(await loadProfile(d.userId)));
  }),
);
