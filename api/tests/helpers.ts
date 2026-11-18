// Test helpers: clean DB, factories, logged-in supertest agents.
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { signSession, SESSION_COOKIE } from '../src/middleware/auth.js';

export const app = createApp();
export { prisma };
export const PASSWORD = 'Test-pass-123';

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

let n = 0;
export async function makeUser(role: Role = 'USER', extra: Partial<{ email: string; status: 'ACTIVE' | 'BANNED'; mustChangePassword: boolean }> = {}) {
  n++;
  return prisma.user.create({
    data: {
      email: extra.email ?? `u${n}-${Date.now()}@test.local`,
      name: `${role} ${n}`,
      role,
      status: extra.status ?? 'ACTIVE',
      mustChangePassword: extra.mustChangePassword ?? false,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      emailVerifiedAt: new Date(),
    },
  });
}

/** Supertest wrapper that sends the session cookie of `userId`. */
export function as(userId: string) {
  const cookie = `${SESSION_COOKIE}=${signSession(userId)}`;
  return {
    get: (url: string) => request(app).get(url).set('Cookie', cookie),
    post: (url: string) => request(app).post(url).set('Cookie', cookie),
    put: (url: string) => request(app).put(url).set('Cookie', cookie),
    patch: (url: string) => request(app).patch(url).set('Cookie', cookie),
    delete: (url: string) => request(app).delete(url).set('Cookie', cookie),
  };
}

export const anon = () => request(app);

export interface CourseOpts {
  lessons?: number;
  durationSec?: number;
  isFree?: boolean;
  priceMinor?: number;
  priceThbMinor?: number | null;
  quiz?: { passPercent?: number; timeLimitMin?: number | null; maxAttempts?: number; essay?: boolean } | false;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sourceHeight?: number;
  allow4k?: boolean;
}

export async function makeCourse(o: CourseOpts = {}) {
  n++;
  const lessonCount = o.lessons ?? 2;
  const quiz = o.quiz === false ? null : (o.quiz ?? {});
  return prisma.course.create({
    data: {
      slug: `course-${n}-${Date.now()}`,
      title: `Course ${n}`,
      summary: 'Summary',
      description: 'Description',
      outcomes: [],
      status: o.status ?? 'PUBLISHED',
      publishedAt: new Date(),
      isFree: o.isFree ?? true,
      priceMinor: o.priceMinor ?? 0,
      priceThbMinor: o.priceThbMinor ?? null,
      allow4k: o.allow4k ?? false,
      lessons: {
        create: Array.from({ length: lessonCount }, (_, i) => ({
          order: i + 1,
          title: `Lesson ${i + 1}`,
          bunnyVideoId: `dev-${n}-${i}`,
          videoStatus: 'READY' as const,
          durationSec: o.durationSec ?? 100,
          sourceHeight: o.sourceHeight ?? 1080,
        })),
      },
      quiz: quiz
        ? {
            create: {
              passPercent: quiz.passPercent ?? 50,
              timeLimitMin: quiz.timeLimitMin === undefined ? 10 : quiz.timeLimitMin,
              maxAttempts: quiz.maxAttempts ?? 2,
              questions: {
                create: [
                  {
                    order: 1,
                    type: 'MCQ',
                    text: 'Q1',
                    points: 1,
                    options: { create: [{ text: 'right', isCorrect: true }, { text: 'wrong', isCorrect: false }] },
                  },
                  ...(quiz.essay ? [{ order: 2, type: 'ESSAY' as const, text: 'Essay', points: 1 }] : []),
                ],
              },
            },
          }
        : undefined,
    },
    include: { lessons: { orderBy: { order: 'asc' } }, quiz: { include: { questions: { include: { options: true } } } } },
  });
}

export async function enroll(userId: string, courseId: string) {
  return prisma.enrollment.create({ data: { userId, courseId } });
}

/** Marks every lesson of the current cycle completed. */
export async function completeAllLessons(enrollmentId: string) {
  const e = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { course: { include: { lessons: true } } } });
  for (const l of e.course.lessons) {
    await prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId_cycle: { enrollmentId, lessonId: l.id, cycle: e.cycle } },
      create: { enrollmentId, lessonId: l.id, cycle: e.cycle, watchedSec: l.durationSec, completed: true },
      update: { watchedSec: l.durationSec, completed: true },
    });
  }
}

export function optionIds(course: Awaited<ReturnType<typeof makeCourse>>) {
  const q = course.quiz!.questions.find((x) => x.type === 'MCQ')!;
  return { questionId: q.id, right: q.options.find((o) => o.isCorrect)!.id, wrong: q.options.find((o) => !o.isCorrect)!.id };
}

/** A tiny valid PNG of the given byte size (padded). */
export function pngBase64(bytes = 100) {
  const head = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, bytes - head.length))]).toString('base64');
}
