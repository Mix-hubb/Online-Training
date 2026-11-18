// slugify(title) + unique course slug.
import { prisma } from '../db.js';

export function slugify(s: string): string {
  const base = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'course';
}

export async function uniqueCourseSlug(title: string, exceptId?: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const found = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === exceptId) return slug;
  }
}
