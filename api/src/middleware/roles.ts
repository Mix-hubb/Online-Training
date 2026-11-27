// Role guards added by the change request. Use after requireAuth.
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

/** Role INSTRUCTOR or ADMIN. */
export function requireInstructor(req: Request, _res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== 'INSTRUCTOR' && role !== 'ADMIN') return next(new AppError('FORBIDDEN', 403));
  next();
}

/** INSTRUCTOR with an APPROVED profile (2026-11-27), or ADMIN. Use after requireInstructor. */
export async function requireApprovedInstructor(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.user?.role === 'ADMIN') return next();
    const p = await prisma.instructorProfile.findUnique({ where: { userId: req.user!.id }, select: { status: true } });
    if (p?.status !== 'APPROVED') throw new AppError('INSTRUCTOR_NOT_APPROVED', 403, 'Your instructor account is waiting for approval');
    next();
  } catch (e) {
    next(e);
  }
}

/** Role PARTNER, or INSTRUCTOR with a linked Partner. Loads req.partner (own record only). */
export async function requirePartner(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user || (user.role !== 'PARTNER' && user.role !== 'INSTRUCTOR')) throw new AppError('FORBIDDEN', 403);
    const partner = await prisma.partner.findUnique({ where: { userId: user.id } });
    if (!partner) throw new AppError('NOT_A_PARTNER', 403);
    req.partner = partner;
    next();
  } catch (e) {
    next(e);
  }
}

export async function isAssigned(userId: string, courseId: string): Promise<boolean> {
  const row = await prisma.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId } } });
  return Boolean(row);
}

/** Instructor must be assigned (CourseInstructor) to the course in req.params[param]. Admins pass. */
export function requireCourseAssignment(param = 'courseId') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.role === 'ADMIN') return next();
      const courseId = req.params[param];
      if (!courseId || !(await isAssigned(req.user!.id, courseId))) throw new AppError('NOT_ASSIGNED', 403);
      next();
    } catch (e) {
      next(e);
    }
  };
}
